import { Router, type Request, type Response } from "express";
import { randomUUID, randomBytes } from "node:crypto";
import { query } from "./db";
import {
  requireAuth,
  requireParent,
  setSession,
  hashPassword,
  cleanUsername,
} from "./auth";

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: "Server error" });
    });
  };

function newInviteCode(): string {
  return `MP-${randomBytes(4).toString("hex").toUpperCase()}`;
}

const childCols = `
  c.id,
  c.name,
  c.instrument,
  c.color,
  c.sort_order AS "sortOrder",
  c.invite_code AS "inviteCode",
  (c.user_id IS NOT NULL) AS "joined",
  u.username AS "username"
`;

/* ----------------------- parent-managed children ------------------------ */

export const childrenRouter = Router();

childrenRouter.get(
  "/children",
  requireAuth,
  h(async (req, res) => {
    const rows = await query(
      `SELECT ${childCols} FROM mp_children c
       LEFT JOIN mp_users u ON u.id = c.user_id
       WHERE c.family_id = $1
       ORDER BY c.sort_order, c.created_at`,
      [req.user!.familyId],
    );
    res.json(rows);
  }),
);

childrenRouter.post(
  "/children",
  requireAuth,
  requireParent,
  h(async (req, res) => {
    const { name, instrument = "", color = "teal" } = req.body ?? {};
    if (!name || !String(name).trim())
      return void res.status(400).json({ error: "The child's name is required" });
    const id = randomUUID();
    const [row] = await query(
      `INSERT INTO mp_children (id, family_id, name, instrument, color, invite_code, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM mp_children WHERE family_id = $2))
       RETURNING id, name, instrument, color, sort_order AS "sortOrder",
                 invite_code AS "inviteCode", false AS "joined", NULL AS "username"`,
      [id, req.user!.familyId, String(name).trim(), String(instrument).trim(), String(color), newInviteCode()],
    );
    res.status(201).json(row);
  }),
);

childrenRouter.patch(
  "/children/:id",
  requireAuth,
  requireParent,
  h(async (req, res) => {
    const { name, instrument, color } = req.body ?? {};
    const [row] = await query(
      `UPDATE mp_children SET
         name = COALESCE($3, name),
         instrument = COALESCE($4, instrument),
         color = COALESCE($5, color)
       WHERE id = $1 AND family_id = $2
       RETURNING id`,
      [req.params.id, req.user!.familyId, name ?? null, instrument ?? null, color ?? null],
    );
    if (!row) return void res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  }),
);

childrenRouter.delete(
  "/children/:id",
  requireAuth,
  requireParent,
  h(async (req, res) => {
    // Remove the linked login account too (sessions cascade from the profile).
    const rows = await query<{ user_id: string | null }>(
      `SELECT user_id FROM mp_children WHERE id = $1 AND family_id = $2`,
      [req.params.id, req.user!.familyId],
    );
    if (!rows.length) return void res.status(404).json({ error: "Not found" });
    await query(`DELETE FROM mp_children WHERE id = $1 AND family_id = $2`, [req.params.id, req.user!.familyId]);
    if (rows[0].user_id) await query(`DELETE FROM mp_users WHERE id = $1`, [rows[0].user_id]);
    res.status(204).end();
  }),
);

// Regenerate an invite code (only meaningful while the child hasn't joined).
childrenRouter.post(
  "/children/:id/new-invite",
  requireAuth,
  requireParent,
  h(async (req, res) => {
    const [row] = await query<{ inviteCode: string }>(
      `UPDATE mp_children SET invite_code = $3
       WHERE id = $1 AND family_id = $2 AND user_id IS NULL
       RETURNING invite_code AS "inviteCode"`,
      [req.params.id, req.user!.familyId, newInviteCode()],
    );
    if (!row) return void res.status(400).json({ error: "This child has already joined" });
    res.json(row);
  }),
);

// Parent resets a child's password.
childrenRouter.post(
  "/children/:id/reset-password",
  requireAuth,
  requireParent,
  h(async (req, res) => {
    const password = String(req.body?.password ?? "");
    if (password.length < 4) return void res.status(400).json({ error: "Password must be at least 4 characters" });
    const rows = await query<{ user_id: string | null }>(
      `SELECT user_id FROM mp_children WHERE id = $1 AND family_id = $2`,
      [req.params.id, req.user!.familyId],
    );
    if (!rows.length || !rows[0].user_id)
      return void res.status(400).json({ error: "This child hasn't joined yet" });
    await query(`UPDATE mp_users SET password_hash = $2 WHERE id = $1`, [rows[0].user_id, hashPassword(password)]);
    res.json({ ok: true });
  }),
);

// The logged-in child's own profile (used by the child UI).
childrenRouter.get(
  "/me/child",
  requireAuth,
  h(async (req, res) => {
    if (req.user!.role !== "child") return void res.status(404).json({ error: "Not a child account" });
    const rows = await query(
      `SELECT id, name, instrument, color FROM mp_children WHERE user_id = $1`,
      [req.user!.id],
    );
    if (!rows.length) return void res.status(404).json({ error: "No child profile" });
    res.json(rows[0]);
  }),
);

/* ------------------------- adults (co-parents) -------------------------- */

// All adults in the family (any signed-in member can see who the parents are).
childrenRouter.get(
  "/parents",
  requireAuth,
  h(async (req, res) => {
    const rows = await query(
      `SELECT id, display_name AS "displayName", username, (id = $2) AS "isSelf"
       FROM mp_users WHERE family_id = $1 AND role = 'parent' ORDER BY created_at`,
      [req.user!.familyId, req.user!.id],
    );
    res.json(rows);
  }),
);

childrenRouter.get(
  "/parent-invites",
  requireAuth,
  requireParent,
  h(async (req, res) => {
    const rows = await query(
      `SELECT code, display_name AS "displayName" FROM mp_parent_invites
       WHERE family_id = $1 ORDER BY created_at`,
      [req.user!.familyId],
    );
    res.json(rows);
  }),
);

childrenRouter.post(
  "/parent-invites",
  requireAuth,
  requireParent,
  h(async (req, res) => {
    const displayName = String(req.body?.displayName ?? "").trim();
    const code = newInviteCode();
    await query(
      `INSERT INTO mp_parent_invites (code, family_id, display_name) VALUES ($1, $2, $3)`,
      [code, req.user!.familyId, displayName],
    );
    res.status(201).json({ code, displayName });
  }),
);

childrenRouter.delete(
  "/parent-invites/:code",
  requireAuth,
  requireParent,
  h(async (req, res) => {
    await query(`DELETE FROM mp_parent_invites WHERE code = $1 AND family_id = $2`, [req.params.code, req.user!.familyId]);
    res.status(204).end();
  }),
);

// Remove another adult — never yourself, and never the last parent.
childrenRouter.delete(
  "/parents/:id",
  requireAuth,
  requireParent,
  h(async (req, res) => {
    if (req.params.id === req.user!.id) return void res.status(400).json({ error: "You can't remove yourself" });
    const count = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM mp_users WHERE family_id = $1 AND role = 'parent'`,
      [req.user!.familyId],
    );
    if (Number(count[0]?.n ?? 0) <= 1)
      return void res.status(400).json({ error: "A family needs at least one parent" });
    await query(`DELETE FROM mp_users WHERE id = $1 AND family_id = $2 AND role = 'parent'`, [
      req.params.id, req.user!.familyId,
    ]);
    res.status(204).end();
  }),
);

/* --------------------------- public invites ----------------------------- */

export const publicInviteRouter = Router();

// Preview an invite (shown on the join screen) — no auth. Works for both a
// child invite (mp_children.invite_code) and an adult invite (mp_parent_invites).
publicInviteRouter.get(
  "/invite/:code",
  h(async (req, res) => {
    const child = await query<{ name: string; familyName: string }>(
      `SELECT c.name, f.name AS "familyName"
       FROM mp_children c JOIN mp_families f ON f.id = c.family_id
       WHERE c.invite_code = $1 AND c.user_id IS NULL`,
      [req.params.code],
    );
    if (child.length) return void res.json({ ...child[0], role: "child" });

    const parent = await query<{ name: string; familyName: string }>(
      `SELECT pi.display_name AS name, f.name AS "familyName"
       FROM mp_parent_invites pi JOIN mp_families f ON f.id = pi.family_id
       WHERE pi.code = $1`,
      [req.params.code],
    );
    if (parent.length) return void res.json({ ...parent[0], role: "parent" });

    res.status(404).json({ error: "This invite is invalid or already used" });
  }),
);

// Accept an invite: create the child's login and link it to the profile.
publicInviteRouter.post(
  "/invite/:code/accept",
  h(async (req, res) => {
    const username = cleanUsername(req.body?.username);
    const password = String(req.body?.password ?? "");
    if (username.length < 3 || !/^[a-z0-9_.-]+$/.test(username))
      return void res.status(400).json({ error: "Username must be 3+ chars: letters, numbers, . _ -" });
    if (password.length < 4) return void res.status(400).json({ error: "Password must be at least 4 characters" });

    const taken = await query(`SELECT 1 FROM mp_users WHERE username = $1`, [username]);
    if (taken.length) return void res.status(409).json({ error: "That username is taken" });

    // A child invite?
    const childRows = await query<{ id: string; family_id: string; name: string }>(
      `SELECT id, family_id, name FROM mp_children WHERE invite_code = $1 AND user_id IS NULL`,
      [req.params.code],
    );
    if (childRows.length) {
      const child = childRows[0];
      const userId = randomUUID();
      await query(
        `INSERT INTO mp_users (id, family_id, role, username, password_hash, display_name)
         VALUES ($1, $2, 'child', $3, $4, $5)`,
        [userId, child.family_id, username, hashPassword(password), child.name],
      );
      await query(`UPDATE mp_children SET user_id = $1, invite_code = NULL WHERE id = $2`, [userId, child.id]);
      await setSession(res, userId);
      return void res.status(201).json({ id: userId, role: "child", displayName: child.name, username });
    }

    // An adult invite?
    const parentRows = await query<{ family_id: string; display_name: string }>(
      `SELECT family_id, display_name FROM mp_parent_invites WHERE code = $1`,
      [req.params.code],
    );
    if (parentRows.length) {
      const inv = parentRows[0];
      const name = inv.display_name || username;
      const userId = randomUUID();
      await query(
        `INSERT INTO mp_users (id, family_id, role, username, password_hash, display_name)
         VALUES ($1, $2, 'parent', $3, $4, $5)`,
        [userId, inv.family_id, username, hashPassword(password), name],
      );
      await query(`DELETE FROM mp_parent_invites WHERE code = $1`, [req.params.code]);
      await setSession(res, userId);
      return void res.status(201).json({ id: userId, role: "parent", displayName: name, username });
    }

    res.status(404).json({ error: "This invite is invalid or already used" });
  }),
);

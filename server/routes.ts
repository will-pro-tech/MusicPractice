import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { query } from "./db";
import { songsRouter } from "./songs";
import { servicesRouter } from "./services";
import { authRouter, requireAuth, requireParent } from "./auth";
import { childrenRouter, publicInviteRouter } from "./family";

export const api = Router();

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: "Server error" });
    });
  };

// --- Public (no session needed) ---
api.get("/healthz", (_req, res) => res.json({ ok: true }));
api.use(authRouter); // register / login / logout / me
api.use(publicInviteRouter); // view + accept an invite

// --- Everything below requires a signed-in user ---
api.use(requireAuth);
api.use(childrenRouter); // family children + /me/child
api.use(songsRouter); // repertoire (family-scoped)
api.use(servicesRouter); // Sunday services + /sunday-songs

async function childIdOf(req: Request): Promise<string | null> {
  const rows = await query<{ id: string }>(`SELECT id FROM mp_children WHERE user_id = $1`, [req.user!.id]);
  return rows[0]?.id ?? null;
}

const sessionCols = `
  id,
  child_id AS "childId",
  practice_date::text AS "date",
  practice_time AS "time",
  exercises_note AS "exercisesNote",
  exercises_done AS "exercisesDone",
  church_song AS "churchSong",
  church_done AS "churchDone",
  new_song AS "newSong",
  new_song_goal AS "newSongGoal",
  new_song_goal_met AS "newSongGoalMet",
  notes,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

// List sessions. Children see only their own; parents can see any child.
api.get(
  "/sessions",
  h(async (req, res) => {
    const params: unknown[] = [req.user!.familyId];
    const clauses = ["family_id = $1"];
    if (req.user!.role === "child") {
      const cid = await childIdOf(req);
      if (!cid) return void res.json([]);
      params.push(cid);
      clauses.push(`child_id = $${params.length}`);
    } else if (req.query.childId) {
      params.push(req.query.childId);
      clauses.push(`child_id = $${params.length}`);
    }
    if (req.query.date) {
      params.push(req.query.date);
      clauses.push(`practice_date = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      clauses.push(`practice_date >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      clauses.push(`practice_date <= $${params.length}`);
    }
    const rows = await query(
      `SELECT ${sessionCols} FROM mp_sessions WHERE ${clauses.join(" AND ")}
       ORDER BY practice_date DESC, practice_time ASC NULLS LAST, created_at DESC`,
      params,
    );
    res.json(rows);
  }),
);

// Only a child plans their own practice.
api.post(
  "/sessions",
  h(async (req, res) => {
    if (req.user!.role !== "child") return void res.status(403).json({ error: "Only children plan practices" });
    const cid = await childIdOf(req);
    if (!cid) return void res.status(400).json({ error: "No child profile" });
    const b = req.body ?? {};
    if (!b.date) return void res.status(400).json({ error: "Practice date is required" });
    const [row] = await query(
      `INSERT INTO mp_sessions
        (id, family_id, child_id, practice_date, practice_time,
         exercises_note, exercises_done, church_song, church_done,
         new_song, new_song_goal, new_song_goal_met, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING ${sessionCols}`,
      [
        randomUUID(), req.user!.familyId, cid, b.date, b.time || null,
        b.exercisesNote ?? "", !!b.exercisesDone,
        b.churchSong ?? "", !!b.churchDone,
        b.newSong ?? "", b.newSongGoal ?? "", !!b.newSongGoalMet, b.notes ?? "",
      ],
    );
    res.status(201).json(row);
  }),
);

api.patch(
  "/sessions/:id",
  h(async (req, res) => {
    if (req.user!.role !== "child") return void res.status(403).json({ error: "Only the child can edit their practice" });
    const cid = await childIdOf(req);
    const b = req.body ?? {};
    const [row] = await query(
      `UPDATE mp_sessions SET
         practice_date = COALESCE($4, practice_date),
         practice_time = COALESCE($5, practice_time),
         exercises_note = COALESCE($6, exercises_note),
         exercises_done = COALESCE($7, exercises_done),
         church_song = COALESCE($8, church_song),
         church_done = COALESCE($9, church_done),
         new_song = COALESCE($10, new_song),
         new_song_goal = COALESCE($11, new_song_goal),
         new_song_goal_met = COALESCE($12, new_song_goal_met),
         notes = COALESCE($13, notes),
         updated_at = now()
       WHERE id = $1 AND family_id = $2 AND child_id = $3
       RETURNING ${sessionCols}`,
      [
        req.params.id, req.user!.familyId, cid,
        b.date ?? null, b.time ?? null,
        b.exercisesNote ?? null,
        typeof b.exercisesDone === "boolean" ? b.exercisesDone : null,
        b.churchSong ?? null,
        typeof b.churchDone === "boolean" ? b.churchDone : null,
        b.newSong ?? null, b.newSongGoal ?? null,
        typeof b.newSongGoalMet === "boolean" ? b.newSongGoalMet : null,
        b.notes ?? null,
      ],
    );
    if (!row) return void res.status(404).json({ error: "Not found" });
    res.json(row);
  }),
);

api.delete(
  "/sessions/:id",
  h(async (req, res) => {
    if (req.user!.role !== "child") return void res.status(403).json({ error: "Only the child can delete their practice" });
    const cid = await childIdOf(req);
    await query(`DELETE FROM mp_sessions WHERE id = $1 AND family_id = $2 AND child_id = $3`, [
      req.params.id, req.user!.familyId, cid,
    ]);
    res.status(204).end();
  }),
);

// Parent overview: each child with recent sessions and days practiced.
api.get(
  "/summary",
  requireParent,
  h(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 180);
    const children = await query<{ id: string }>(
      `SELECT id, name, instrument, color, sort_order AS "sortOrder"
       FROM mp_children WHERE family_id = $1 ORDER BY sort_order, created_at`,
      [req.user!.familyId],
    );
    const result = [];
    for (const child of children) {
      const sessions = await query<{ date: string }>(
        `SELECT ${sessionCols} FROM mp_sessions
         WHERE child_id = $1 AND practice_date >= (CURRENT_DATE - $2::int)
         ORDER BY practice_date DESC, practice_time ASC NULLS LAST, created_at DESC`,
        [child.id, days],
      );
      const daysPracticed = new Set(sessions.map((s) => s.date)).size;
      result.push({ child, daysPracticed, sessions });
    }
    res.json({ days, children: result });
  }),
);

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { query } from "./db";
import { requireParent } from "./auth";

export const songsRouter = Router();

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: "Server error" });
    });
  };

const cols = `id, title, tags, notes, created_at AS "createdAt"`;

// List this family's songs, optionally filtered by search term and/or tag.
songsRouter.get(
  "/songs",
  h(async (req, res) => {
    const params: unknown[] = [req.user!.familyId];
    const clauses = ["family_id = $1"];
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      clauses.push(`title ILIKE $${params.length}`);
    }
    if (req.query.tag) {
      params.push(req.query.tag);
      clauses.push(`tags ? $${params.length}`);
    }
    const rows = await query(
      `SELECT ${cols} FROM mp_songs WHERE ${clauses.join(" AND ")} ORDER BY title`,
      params,
    );
    res.json(rows);
  }),
);

songsRouter.get(
  "/song-tags",
  h(async (req, res) => {
    const rows = await query<{ tag: string }>(
      `SELECT DISTINCT jsonb_array_elements_text(tags) AS tag
       FROM mp_songs WHERE family_id = $1 ORDER BY tag`,
      [req.user!.familyId],
    );
    res.json(rows.map((r) => r.tag));
  }),
);

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((t) => String(t).trim()).filter(Boolean)));
}

songsRouter.post(
  "/songs",
  requireParent,
  h(async (req, res) => {
    const { title, tags, notes = "" } = req.body ?? {};
    if (!title || !String(title).trim())
      return void res.status(400).json({ error: "Song name is required" });
    const [row] = await query(
      `INSERT INTO mp_songs (id, family_id, title, tags, notes)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING ${cols}`,
      [randomUUID(), req.user!.familyId, String(title).trim(), JSON.stringify(normalizeTags(tags)), String(notes)],
    );
    res.status(201).json(row);
  }),
);

songsRouter.patch(
  "/songs/:id",
  requireParent,
  h(async (req, res) => {
    const { title, tags, notes } = req.body ?? {};
    const [row] = await query(
      `UPDATE mp_songs SET
         title = COALESCE($3, title),
         tags = COALESCE($4::jsonb, tags),
         notes = COALESCE($5, notes)
       WHERE id = $1 AND family_id = $2
       RETURNING ${cols}`,
      [
        req.params.id,
        req.user!.familyId,
        title != null ? String(title).trim() : null,
        Array.isArray(tags) ? JSON.stringify(normalizeTags(tags)) : null,
        notes != null ? String(notes) : null,
      ],
    );
    if (!row) return void res.status(404).json({ error: "Not found" });
    res.json(row);
  }),
);

songsRouter.delete(
  "/songs/:id",
  requireParent,
  h(async (req, res) => {
    await query(`DELETE FROM mp_songs WHERE id = $1 AND family_id = $2`, [req.params.id, req.user!.familyId]);
    res.status(204).end();
  }),
);

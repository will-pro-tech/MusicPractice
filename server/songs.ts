import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { query } from "./db";

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

// List songs, optionally filtered by a search term and/or a tag.
songsRouter.get(
  "/songs",
  h(async (req, res) => {
    const { q, tag } = req.query;
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (q) {
      params.push(`%${q}%`);
      clauses.push(`title ILIKE $${params.length}`);
    }
    if (tag) {
      params.push(tag);
      clauses.push(`tags ? $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await query(`SELECT ${cols} FROM mp_songs ${where} ORDER BY title`, params);
    res.json(rows);
  }),
);

// Distinct tags across the whole repertoire — powers the filter chips.
songsRouter.get(
  "/song-tags",
  h(async (_req, res) => {
    const rows = await query<{ tag: string }>(
      `SELECT DISTINCT jsonb_array_elements_text(tags) AS tag FROM mp_songs ORDER BY tag`,
    );
    res.json(rows.map((r) => r.tag));
  }),
);

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((t) => String(t).trim())
        .filter(Boolean),
    ),
  );
}

songsRouter.post(
  "/songs",
  h(async (req, res) => {
    const { title, tags, notes = "" } = req.body ?? {};
    if (!title || !String(title).trim()) {
      res.status(400).json({ error: "Song name is required" });
      return;
    }
    const [row] = await query(
      `INSERT INTO mp_songs (id, title, tags, notes)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING ${cols}`,
      [randomUUID(), String(title).trim(), JSON.stringify(normalizeTags(tags)), String(notes)],
    );
    res.status(201).json(row);
  }),
);

songsRouter.patch(
  "/songs/:id",
  h(async (req, res) => {
    const { title, tags, notes } = req.body ?? {};
    const [row] = await query(
      `UPDATE mp_songs SET
         title = COALESCE($2, title),
         tags = COALESCE($3::jsonb, tags),
         notes = COALESCE($4, notes)
       WHERE id = $1
       RETURNING ${cols}`,
      [
        req.params.id,
        title != null ? String(title).trim() : null,
        Array.isArray(tags) ? JSON.stringify(normalizeTags(tags)) : null,
        notes != null ? String(notes) : null,
      ],
    );
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  }),
);

songsRouter.delete(
  "/songs/:id",
  h(async (req, res) => {
    await query(`DELETE FROM mp_songs WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  }),
);

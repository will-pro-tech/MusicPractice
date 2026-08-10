import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { query } from "./db";
import { songsRouter } from "./songs";
import { servicesRouter } from "./services";

export const api = Router();

// Repertoire (songs + tags) and Sunday service planning.
api.use(songsRouter);
api.use(servicesRouter);

// Small wrapper so async handlers surface errors as clean 500s.
const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: "Error del servidor" });
    });
  };

api.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

/* ------------------------------- children ------------------------------- */

const childCols = `id, name, instrument, color, sort_order AS "sortOrder", created_at AS "createdAt"`;

api.get(
  "/children",
  h(async (_req, res) => {
    const rows = await query(
      `SELECT ${childCols} FROM mp_children ORDER BY sort_order, created_at`,
    );
    res.json(rows);
  }),
);

api.post(
  "/children",
  h(async (req, res) => {
    const { name, instrument = "", color = "teal" } = req.body ?? {};
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: "El nombre es obligatorio" });
      return;
    }
    const [row] = await query(
      `INSERT INTO mp_children (id, name, instrument, color, sort_order)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM mp_children))
       RETURNING ${childCols}`,
      [randomUUID(), String(name).trim(), String(instrument).trim(), String(color)],
    );
    res.status(201).json(row);
  }),
);

api.patch(
  "/children/:id",
  h(async (req, res) => {
    const { name, instrument, color } = req.body ?? {};
    const [row] = await query(
      `UPDATE mp_children SET
         name = COALESCE($2, name),
         instrument = COALESCE($3, instrument),
         color = COALESCE($4, color)
       WHERE id = $1
       RETURNING ${childCols}`,
      [req.params.id, name ?? null, instrument ?? null, color ?? null],
    );
    if (!row) {
      res.status(404).json({ error: "No encontrado" });
      return;
    }
    res.json(row);
  }),
);

api.delete(
  "/children/:id",
  h(async (req, res) => {
    await query(`DELETE FROM mp_children WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  }),
);

/* ------------------------------- sessions ------------------------------- */

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

api.get(
  "/sessions",
  h(async (req, res) => {
    const { childId, from, to, date } = req.query;
    const clauses: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      clauses.push(sql.replace("$?", `$${params.length}`));
    };
    if (childId) add("child_id = $?", childId);
    if (date) add("practice_date = $?", date);
    if (from) add("practice_date >= $?", from);
    if (to) add("practice_date <= $?", to);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await query(
      `SELECT ${sessionCols} FROM mp_sessions ${where}
       ORDER BY practice_date DESC, practice_time ASC NULLS LAST, created_at DESC`,
      params,
    );
    res.json(rows);
  }),
);

api.post(
  "/sessions",
  h(async (req, res) => {
    const b = req.body ?? {};
    if (!b.childId) {
      res.status(400).json({ error: "Falta indicar el niño" });
      return;
    }
    if (!b.date) {
      res.status(400).json({ error: "Falta la fecha de práctica" });
      return;
    }
    const [row] = await query(
      `INSERT INTO mp_sessions
        (id, child_id, practice_date, practice_time,
         exercises_note, exercises_done,
         church_song, church_done,
         new_song, new_song_goal, new_song_goal_met, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING ${sessionCols}`,
      [
        randomUUID(),
        b.childId,
        b.date,
        b.time || null,
        b.exercisesNote ?? "",
        !!b.exercisesDone,
        b.churchSong ?? "",
        !!b.churchDone,
        b.newSong ?? "",
        b.newSongGoal ?? "",
        !!b.newSongGoalMet,
        b.notes ?? "",
      ],
    );
    res.status(201).json(row);
  }),
);

api.patch(
  "/sessions/:id",
  h(async (req, res) => {
    const b = req.body ?? {};
    const [row] = await query(
      `UPDATE mp_sessions SET
         practice_date = COALESCE($2, practice_date),
         practice_time = COALESCE($3, practice_time),
         exercises_note = COALESCE($4, exercises_note),
         exercises_done = COALESCE($5, exercises_done),
         church_song = COALESCE($6, church_song),
         church_done = COALESCE($7, church_done),
         new_song = COALESCE($8, new_song),
         new_song_goal = COALESCE($9, new_song_goal),
         new_song_goal_met = COALESCE($10, new_song_goal_met),
         notes = COALESCE($11, notes),
         updated_at = now()
       WHERE id = $1
       RETURNING ${sessionCols}`,
      [
        req.params.id,
        b.date ?? null,
        b.time ?? null,
        b.exercisesNote ?? null,
        typeof b.exercisesDone === "boolean" ? b.exercisesDone : null,
        b.churchSong ?? null,
        typeof b.churchDone === "boolean" ? b.churchDone : null,
        b.newSong ?? null,
        b.newSongGoal ?? null,
        typeof b.newSongGoalMet === "boolean" ? b.newSongGoalMet : null,
        b.notes ?? null,
      ],
    );
    if (!row) {
      res.status(404).json({ error: "No encontrado" });
      return;
    }
    res.json(row);
  }),
);

api.delete(
  "/sessions/:id",
  h(async (req, res) => {
    await query(`DELETE FROM mp_sessions WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  }),
);

/* -------------------------------- summary ------------------------------- */

// Parent view: each child with their recent sessions and how many distinct
// days they practiced in the window. Goals & repertoire, never a time score.
api.get(
  "/summary",
  h(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 180);
    const children = await query<{ id: string }>(
      `SELECT ${childCols} FROM mp_children ORDER BY sort_order, created_at`,
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

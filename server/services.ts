import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { query } from "./db";

export const servicesRouter = Router();

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: "Server error" });
    });
  };

const serviceCols = `id, service_date::text AS "date", theme, notes, created_at AS "createdAt"`;

interface ServiceRow {
  id: string;
  date: string;
  theme: string;
  notes: string;
  createdAt: string;
}

// Returns the ordered songs of a service, joined to the live repertoire so we
// get current tags, but falling back to the stored title snapshot.
async function songsForService(serviceId: string) {
  return query(
    `SELECT ss.id,
            ss.song_id AS "songId",
            COALESCE(s.title, ss.title) AS title,
            COALESCE(s.tags, '[]'::jsonb) AS tags
     FROM mp_service_songs ss
     LEFT JOIN mp_songs s ON s.id = ss.song_id
     WHERE ss.service_id = $1
     ORDER BY ss.sort_order`,
    [serviceId],
  );
}

// Replace the full ordered set of songs for a service.
async function setSongs(serviceId: string, songIds: unknown) {
  const ids = Array.isArray(songIds) ? songIds.map(String) : [];
  await query(`DELETE FROM mp_service_songs WHERE service_id = $1`, [serviceId]);
  if (ids.length === 0) return;
  const titles = await query<{ id: string; title: string }>(
    `SELECT id, title FROM mp_songs WHERE id = ANY($1::text[])`,
    [ids],
  );
  const titleById = new Map(titles.map((t) => [t.id, t.title]));
  for (let i = 0; i < ids.length; i++) {
    await query(
      `INSERT INTO mp_service_songs (id, service_id, song_id, title, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), serviceId, ids[i], titleById.get(ids[i]) ?? "", i],
    );
  }
}

servicesRouter.get(
  "/services",
  h(async (_req, res) => {
    const services = await query<ServiceRow>(
      `SELECT ${serviceCols} FROM mp_services ORDER BY service_date DESC`,
    );
    const withSongs = [];
    for (const s of services) {
      withSongs.push({ ...s, songs: await songsForService(s.id) });
    }
    res.json(withSongs);
  }),
);

servicesRouter.post(
  "/services",
  h(async (req, res) => {
    const { date, theme = "", notes = "", songIds } = req.body ?? {};
    if (!date) {
      res.status(400).json({ error: "Service date is required" });
      return;
    }
    const [service] = await query<ServiceRow>(
      `INSERT INTO mp_services (id, service_date, theme, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING ${serviceCols}`,
      [randomUUID(), date, String(theme), String(notes)],
    );
    await setSongs(service.id, songIds);
    res.status(201).json({ ...service, songs: await songsForService(service.id) });
  }),
);

servicesRouter.patch(
  "/services/:id",
  h(async (req, res) => {
    const { date, theme, notes, songIds } = req.body ?? {};
    const [service] = await query<ServiceRow>(
      `UPDATE mp_services SET
         service_date = COALESCE($2, service_date),
         theme = COALESCE($3, theme),
         notes = COALESCE($4, notes)
       WHERE id = $1
       RETURNING ${serviceCols}`,
      [req.params.id, date ?? null, theme ?? null, notes ?? null],
    );
    if (!service) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (songIds !== undefined) await setSongs(service.id, songIds);
    res.json({ ...service, songs: await songsForService(service.id) });
  }),
);

servicesRouter.delete(
  "/services/:id",
  h(async (req, res) => {
    await query(`DELETE FROM mp_services WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  }),
);

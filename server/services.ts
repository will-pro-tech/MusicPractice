import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { query } from "./db";
import { requireParent } from "./auth";

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

async function songsForService(serviceId: string) {
  return query(
    `SELECT ss.id, ss.song_id AS "songId",
            COALESCE(s.title, ss.title) AS title,
            COALESCE(s.tags, '[]'::jsonb) AS tags
     FROM mp_service_songs ss
     LEFT JOIN mp_songs s ON s.id = ss.song_id
     WHERE ss.service_id = $1
     ORDER BY ss.sort_order`,
    [serviceId],
  );
}

// Replace the ordered set of songs for a service (song ids scoped to family).
async function setSongs(serviceId: string, familyId: string, songIds: unknown) {
  const ids = Array.isArray(songIds) ? songIds.map(String) : [];
  await query(`DELETE FROM mp_service_songs WHERE service_id = $1`, [serviceId]);
  if (!ids.length) return;
  const titles = await query<{ id: string; title: string }>(
    `SELECT id, title FROM mp_songs WHERE family_id = $1 AND id = ANY($2::text[])`,
    [familyId, ids],
  );
  const titleById = new Map(titles.map((t) => [t.id, t.title]));
  for (let i = 0; i < ids.length; i++) {
    if (!titleById.has(ids[i])) continue; // ignore ids from another family
    await query(
      `INSERT INTO mp_service_songs (id, service_id, song_id, title, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), serviceId, ids[i], titleById.get(ids[i]) ?? "", i],
    );
  }
}

servicesRouter.get(
  "/services",
  h(async (req, res) => {
    const services = await query<ServiceRow>(
      `SELECT ${serviceCols} FROM mp_services WHERE family_id = $1 ORDER BY service_date DESC`,
      [req.user!.familyId],
    );
    const withSongs = [];
    for (const s of services) withSongs.push({ ...s, songs: await songsForService(s.id) });
    res.json(withSongs);
  }),
);

// Songs picked for the relevant Sunday — the next upcoming service, or the most
// recent one if none is upcoming. Children choose their church song from here.
servicesRouter.get(
  "/sunday-songs",
  h(async (req, res) => {
    const upcoming = await query<ServiceRow>(
      `SELECT ${serviceCols} FROM mp_services
       WHERE family_id = $1 AND service_date >= CURRENT_DATE
       ORDER BY service_date ASC LIMIT 1`,
      [req.user!.familyId],
    );
    const svc =
      upcoming[0] ??
      (
        await query<ServiceRow>(
          `SELECT ${serviceCols} FROM mp_services WHERE family_id = $1
           ORDER BY service_date DESC LIMIT 1`,
          [req.user!.familyId],
        )
      )[0];
    if (!svc) return void res.json({ service: null, songs: [] });
    res.json({ service: { date: svc.date, theme: svc.theme }, songs: await songsForService(svc.id) });
  }),
);

servicesRouter.post(
  "/services",
  requireParent,
  h(async (req, res) => {
    const { date, theme = "", notes = "", songIds } = req.body ?? {};
    if (!date) return void res.status(400).json({ error: "Service date is required" });
    const [service] = await query<ServiceRow>(
      `INSERT INTO mp_services (id, family_id, service_date, theme, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${serviceCols}`,
      [randomUUID(), req.user!.familyId, date, String(theme), String(notes)],
    );
    await setSongs(service.id, req.user!.familyId, songIds);
    res.status(201).json({ ...service, songs: await songsForService(service.id) });
  }),
);

servicesRouter.patch(
  "/services/:id",
  requireParent,
  h(async (req, res) => {
    const { date, theme, notes, songIds } = req.body ?? {};
    const [service] = await query<ServiceRow>(
      `UPDATE mp_services SET
         service_date = COALESCE($3, service_date),
         theme = COALESCE($4, theme),
         notes = COALESCE($5, notes)
       WHERE id = $1 AND family_id = $2
       RETURNING ${serviceCols}`,
      [req.params.id, req.user!.familyId, date ?? null, theme ?? null, notes ?? null],
    );
    if (!service) return void res.status(404).json({ error: "Not found" });
    if (songIds !== undefined) await setSongs(service.id, req.user!.familyId, songIds);
    res.json({ ...service, songs: await songsForService(service.id) });
  }),
);

servicesRouter.delete(
  "/services/:id",
  requireParent,
  h(async (req, res) => {
    await query(`DELETE FROM mp_services WHERE id = $1 AND family_id = $2`, [req.params.id, req.user!.familyId]);
    res.status(204).end();
  }),
);

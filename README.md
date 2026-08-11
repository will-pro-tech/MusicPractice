# My Music Practice

A simple, mobile-first app for kids to log their daily instrument practice and
for parents to follow their progress. The focus is on **goals**, not minutes.
It is a **standalone, self-contained** project.

Each daily practice has three parts:

1. **Exercises** — technique, scales, etc.
2. **Church repertoire song** — chosen from the shared repertoire.
3. **New song** — with a **specific goal** (e.g. "the first two lines of the
   sheet music") and a **"goal met"** checkbox.

Kids also set the **day and time** of each practice.

## Views

- **Kid** (`Today` / `History`): plan the practice and check off what's done.
  History is stored as compact, expandable rows.
- **Parents** (`Summary` / `Repertoire` / `Sundays` / `Kids`):
  - **Summary** — goals and consistency for each child.
  - **Repertoire** — shared song library with **tags/themes** and search.
  - **Sundays** — the band director plans each service by picking songs from the
    repertoire, filtering by theme, and setting the running order.
  - **Kids** — manage children and instruments.

Toggle between "Kid" and "Parents" with the switch at the top right.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4 (installable PWA).
- **Backend:** Express 5 serving the API and the static app on one port.
- **Data:** PostgreSQL (`DATABASE_URL`). Tables (`mp_children`, `mp_sessions`,
  `mp_songs`, `mp_services`, `mp_service_songs`) are created automatically on
  boot — no migrations to run.

## Local development

```bash
# Requires DATABASE_URL pointing at a Postgres instance.
pnpm install
pnpm run dev            # http://localhost:8081  (API + app, with hot reload)
```

## Production build & start

```bash
pnpm run build          # client → dist/public, server → dist/index.mjs
pnpm run start          # NODE_ENV=production node dist/index.mjs
```

## Deploy on Replit

1. **Create Repl → Import from GitHub** and pick this repository.
2. Add a database: **Database** panel (PostgreSQL) — Replit sets `DATABASE_URL`
   automatically.
3. Press **Run** to test it (webview on port 8081).
4. To publish: **Deploy → Autoscale**. The `.replit` already includes the build
   and run commands. Keep the deployment **Public** so the PWA icon works on
   iPhone.
5. On your phone: open the published URL → **Share → "Add to Home Screen"**.

## Passwords & recovery

There's no email, so password recovery is handled inside the family:

- **Change your own password:** account menu (top-right) → **Change password**.
- **A child forgot theirs:** a parent opens **Family → the child → Reset password**.
- **An adult forgot theirs:** another adult opens **Family → Adults → 🔑** next to
  their name and sets a new one.
- **The only adult is locked out:** reset any account straight from the Replit
  Shell (you own the server):
  ```bash
  pnpm run reset-password -- --user=<username> --password=<newpassword>
  ```

## Seed the repertoire

`scripts/songs.json` holds a starter list of songs (title + tags). To load them
into your family's repertoire, run once (with `DATABASE_URL` set):

```bash
pnpm run seed                     # single family: automatic
pnpm run seed -- --user=<name>    # if you have more than one family
pnpm run seed -- --update         # also refresh tags/notes of existing songs
```

Tags are **themes** (adoración, gracia, entrega, …) so the director can pick
Sunday songs by the teaching topic; the artist goes in the song's notes. It's
idempotent — new songs are added and existing ones are skipped, so you can keep
adding entries to `songs.json` and run it again. Use `--update` to push edited
tags/notes onto songs that are already in the repertoire.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET/POST | `/api/children` | List / create kids |
| PATCH/DELETE | `/api/children/:id` | Edit / delete child |
| GET/POST | `/api/sessions` | List (`?childId=&date=&from=&to=`) / create practice |
| PATCH/DELETE | `/api/sessions/:id` | Edit / delete practice |
| GET | `/api/summary?days=30` | Per-child summary (parent view) |
| GET/POST | `/api/songs` | Repertoire: list (`?q=&tag=`) / create song |
| PATCH/DELETE | `/api/songs/:id` | Edit / delete song |
| GET | `/api/song-tags` | Tags/themes for the filters |
| GET/POST | `/api/services` | Sundays: list / create service (with `songIds`) |
| PATCH/DELETE | `/api/services/:id` | Edit (incl. `songIds`) / delete service |
| GET | `/api/healthz` | Health check |

## Accounts, family & invites

Everyone has their own login (username + password, no email needed):

- A **parent** signs up, which creates the **family group**.
- The parent adds each child (name + instrument) in the **Kids** tab, which
  generates a private **invite link**.
- The child opens the link, picks their own username + password, and joins the
  same family. The parent can reset a child's password anytime.
- Each request is authenticated with a signed, http-only session cookie and is
  scoped to the user's family, so families never see each other's data.
  Passwords are stored as scrypt hashes.

Roles come from the account: parents see Summary / Repertoire / Sundays / Kids;
children see their own Today / History.

When a child plans a practice, the **church song** must be chosen from the songs
the parent selected for the upcoming **Sunday** service.

## Notes

- To ship it to the app stores (App Store / Google Play), it can be wrapped with
  Capacitor reusing this same code.

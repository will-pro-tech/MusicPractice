import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const isLocal =
  !connectionString ||
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1");

export const pool = new Pool({
  connectionString,
  // Managed Postgres (Replit/most cloud providers) requires SSL; local dev does not.
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query(text, params as unknown[]);
  return res.rows as T[];
}

/**
 * Creates the two tables the app needs if they don't already exist.
 * Runs once on server boot — no migration tooling required. Table names are
 * prefixed `mp_` so they never collide with any other app sharing the database.
 */
export async function initSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS mp_children (
      id text PRIMARY KEY,
      name text NOT NULL,
      instrument text NOT NULL DEFAULT '',
      color text NOT NULL DEFAULT 'teal',
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS mp_sessions (
      id text PRIMARY KEY,
      child_id text NOT NULL REFERENCES mp_children(id) ON DELETE CASCADE,
      practice_date date NOT NULL,
      practice_time text,
      exercises_note text NOT NULL DEFAULT '',
      exercises_done boolean NOT NULL DEFAULT false,
      church_song text NOT NULL DEFAULT '',
      church_done boolean NOT NULL DEFAULT false,
      new_song text NOT NULL DEFAULT '',
      new_song_goal text NOT NULL DEFAULT '',
      new_song_goal_met boolean NOT NULL DEFAULT false,
      notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await query(
    `CREATE INDEX IF NOT EXISTS mp_sessions_child_date_idx ON mp_sessions (child_id, practice_date);`,
  );

  // Shared song repertoire. Children pick from it when planning, and the band
  // director plans Sunday services from the same list. Tags enable theme search.
  await query(`
    CREATE TABLE IF NOT EXISTS mp_songs (
      id text PRIMARY KEY,
      title text NOT NULL,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // A Sunday service (or any date) the director plans.
  await query(`
    CREATE TABLE IF NOT EXISTS mp_services (
      id text PRIMARY KEY,
      service_date date NOT NULL,
      theme text NOT NULL DEFAULT '',
      notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Ordered songs chosen for a service. Keeps a title snapshot so the plan
  // survives even if the song is later removed from the repertoire.
  await query(`
    CREATE TABLE IF NOT EXISTS mp_service_songs (
      id text PRIMARY KEY,
      service_id text NOT NULL REFERENCES mp_services(id) ON DELETE CASCADE,
      song_id text REFERENCES mp_songs(id) ON DELETE SET NULL,
      title text NOT NULL DEFAULT '',
      sort_order integer NOT NULL DEFAULT 0
    );
  `);

  await query(
    `CREATE INDEX IF NOT EXISTS mp_service_songs_service_idx ON mp_service_songs (service_id);`,
  );
}

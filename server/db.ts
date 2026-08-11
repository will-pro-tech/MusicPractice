import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

/**
 * Decide whether to use SSL. Replit's bundled Postgres (and local dev) advertise
 * `sslmode=disable` and don't accept SSL, so forcing it there breaks the
 * connection. Managed Postgres (Neon, Supabase, etc.) needs SSL — accept its
 * certificate without verifying the chain.
 */
function sslOption(cs?: string): false | { rejectUnauthorized: boolean } | undefined {
  if (!cs) return undefined;
  if (/sslmode=disable/.test(cs) || cs.includes("localhost") || cs.includes("127.0.0.1")) {
    return false;
  }
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString,
  ssl: sslOption(connectionString),
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query(text, params as unknown[]);
  return res.rows as T[];
}

/**
 * Creates every table the app needs if it doesn't already exist, and adds any
 * newer columns to older installs. Runs once on boot — no migration tooling.
 * All tenant tables carry a family_id so one database can hold many families,
 * each isolated from the others.
 */
export async function initSchema(): Promise<void> {
  // Small key/value store — currently holds the signing secret for sessions.
  await query(`
    CREATE TABLE IF NOT EXISTS mp_config (
      key text PRIMARY KEY,
      value text NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS mp_families (
      id text PRIMARY KEY,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Login accounts — one per person (parents and children alike).
  await query(`
    CREATE TABLE IF NOT EXISTS mp_users (
      id text PRIMARY KEY,
      family_id text NOT NULL REFERENCES mp_families(id) ON DELETE CASCADE,
      role text NOT NULL,
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      display_name text NOT NULL,
      recovery_question text,
      recovery_answer_hash text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await query(`ALTER TABLE mp_users ADD COLUMN IF NOT EXISTS recovery_question text;`);
  await query(`ALTER TABLE mp_users ADD COLUMN IF NOT EXISTS recovery_answer_hash text;`);

  // Child profiles (instrument, color). A child has both a profile and a
  // linked user account; user_id is null until the child accepts the invite.
  await query(`
    CREATE TABLE IF NOT EXISTS mp_children (
      id text PRIMARY KEY,
      family_id text REFERENCES mp_families(id) ON DELETE CASCADE,
      user_id text REFERENCES mp_users(id) ON DELETE SET NULL,
      invite_code text UNIQUE,
      name text NOT NULL,
      instrument text NOT NULL DEFAULT '',
      color text NOT NULL DEFAULT 'teal',
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await query(`ALTER TABLE mp_children ADD COLUMN IF NOT EXISTS family_id text REFERENCES mp_families(id) ON DELETE CASCADE;`);
  await query(`ALTER TABLE mp_children ADD COLUMN IF NOT EXISTS user_id text REFERENCES mp_users(id) ON DELETE SET NULL;`);
  await query(`ALTER TABLE mp_children ADD COLUMN IF NOT EXISTS invite_code text;`);

  await query(`
    CREATE TABLE IF NOT EXISTS mp_sessions (
      id text PRIMARY KEY,
      family_id text REFERENCES mp_families(id) ON DELETE CASCADE,
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
  await query(`ALTER TABLE mp_sessions ADD COLUMN IF NOT EXISTS family_id text REFERENCES mp_families(id) ON DELETE CASCADE;`);
  await query(`CREATE INDEX IF NOT EXISTS mp_sessions_child_date_idx ON mp_sessions (child_id, practice_date);`);

  // Shared song repertoire (per family).
  await query(`
    CREATE TABLE IF NOT EXISTS mp_songs (
      id text PRIMARY KEY,
      family_id text REFERENCES mp_families(id) ON DELETE CASCADE,
      title text NOT NULL,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await query(`ALTER TABLE mp_songs ADD COLUMN IF NOT EXISTS family_id text REFERENCES mp_families(id) ON DELETE CASCADE;`);

  await query(`
    CREATE TABLE IF NOT EXISTS mp_services (
      id text PRIMARY KEY,
      family_id text REFERENCES mp_families(id) ON DELETE CASCADE,
      service_date date NOT NULL,
      theme text NOT NULL DEFAULT '',
      notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await query(`ALTER TABLE mp_services ADD COLUMN IF NOT EXISTS family_id text REFERENCES mp_families(id) ON DELETE CASCADE;`);

  await query(`
    CREATE TABLE IF NOT EXISTS mp_service_songs (
      id text PRIMARY KEY,
      service_id text NOT NULL REFERENCES mp_services(id) ON DELETE CASCADE,
      song_id text REFERENCES mp_songs(id) ON DELETE SET NULL,
      title text NOT NULL DEFAULT '',
      sort_order integer NOT NULL DEFAULT 0
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS mp_service_songs_service_idx ON mp_service_songs (service_id);`);

  // Pending invitations for additional adults (co-parents / band director).
  // Children are invited via mp_children.invite_code; adults have no profile
  // row, so their invites live here until accepted.
  await query(`
    CREATE TABLE IF NOT EXISTS mp_parent_invites (
      code text PRIMARY KEY,
      family_id text NOT NULL REFERENCES mp_families(id) ON DELETE CASCADE,
      display_name text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

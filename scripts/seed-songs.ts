import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { query, pool } from "../server/db";

interface SeedSong {
  title: string;
  tags?: string[];
  notes?: string;
}

function arg(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.split("=").slice(1).join("=") : undefined;
}

// Which family to seed into. With a single family it's automatic; otherwise
// pass --user=<your-username> or --family=<id>.
async function resolveFamilyId(): Promise<string> {
  const userArg = arg("user");
  if (userArg) {
    const rows = await query<{ family_id: string }>(
      `SELECT family_id FROM mp_users WHERE username = $1`,
      [userArg.toLowerCase()],
    );
    if (!rows.length) throw new Error(`No user named "${userArg}".`);
    return rows[0].family_id;
  }
  const familyArg = arg("family");
  if (familyArg) return familyArg;

  const fams = await query<{ id: string; name: string }>(
    `SELECT id, name FROM mp_families ORDER BY created_at`,
  );
  if (fams.length === 0) throw new Error("No families yet — create your family in the app first.");
  if (fams.length === 1) return fams[0].id;
  const list = fams.map((f) => `  - ${f.name} (${f.id})`).join("\n");
  throw new Error(`Multiple families found. Re-run with --user=<your-username>:\n${list}`);
}

async function main() {
  const songs: SeedSong[] = JSON.parse(
    readFileSync(new URL("./songs.json", import.meta.url), "utf8"),
  );
  const familyId = await resolveFamilyId();

  let inserted = 0;
  let skipped = 0;
  for (const s of songs) {
    const title = (s.title ?? "").trim();
    if (!title) continue;
    const exists = await query(
      `SELECT 1 FROM mp_songs WHERE family_id = $1 AND lower(title) = lower($2)`,
      [familyId, title],
    );
    if (exists.length) {
      skipped++;
      continue;
    }
    await query(
      `INSERT INTO mp_songs (id, family_id, title, tags, notes) VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [randomUUID(), familyId, title, JSON.stringify(s.tags ?? []), s.notes ?? ""],
    );
    inserted++;
  }

  console.log(`Repertoire seed complete: ${inserted} added, ${skipped} already existed.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

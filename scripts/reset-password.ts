import { randomBytes, scryptSync } from "node:crypto";
import { query, pool } from "../server/db";

// Admin recovery: reset ANY account's password straight from the Replit Shell.
// Use this when the only adult is locked out (there's no email reset).
//   pnpm run reset-password -- --user=<username> --password=<newpassword>

function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

function arg(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.split("=").slice(1).join("=") : undefined;
}

async function main() {
  const user = arg("user");
  const password = arg("password");
  if (!user || !password) {
    console.error("Usage: pnpm run reset-password -- --user=<username> --password=<newpassword>");
    process.exit(1);
  }
  if (password.length < 4) {
    console.error("Password must be at least 4 characters.");
    process.exit(1);
  }
  const rows = await query<{ display_name: string }>(
    `SELECT display_name FROM mp_users WHERE username = $1`,
    [user.toLowerCase()],
  );
  if (!rows.length) {
    console.error(`No account with username "${user}".`);
    process.exit(1);
  }
  await query(`UPDATE mp_users SET password_hash = $2 WHERE username = $1`, [
    user.toLowerCase(),
    hashPassword(password),
  ]);
  console.log(`Password updated for ${rows[0].display_name} (@${user.toLowerCase()}).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

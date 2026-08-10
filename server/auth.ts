import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { query } from "./db";

/* --------------------------- hashing helpers ---------------------------- */

/** Hash a code as "salt:derivedKey", both hex. */
function hashCode(code: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(code, salt, 32);
  return `${salt.toString("hex")}:${dk.toString("hex")}`;
}

/** Constant-time verification of a code against a stored "salt:hash". */
export function verifyCode(code: string, stored: string | null): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(code, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ---------------------------- settings cache ---------------------------- */

interface Settings {
  appCodeHash: string | null;
  parentCodeHash: string | null;
}

let cache: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  const rows = await query<Settings>(
    `SELECT app_code_hash AS "appCodeHash", parent_code_hash AS "parentCodeHash"
     FROM mp_settings WHERE id = 'default'`,
  );
  cache = rows[0] ?? { appCodeHash: null, parentCodeHash: null };
  return cache;
}

async function saveCodes(patch: { appCodeHash?: string; parentCodeHash?: string }) {
  await query(
    `INSERT INTO mp_settings (id, app_code_hash, parent_code_hash)
     VALUES ('default', $1, $2)
     ON CONFLICT (id) DO UPDATE SET
       app_code_hash = COALESCE($1, mp_settings.app_code_hash),
       parent_code_hash = COALESCE($2, mp_settings.parent_code_hash),
       updated_at = now()`,
    [patch.appCodeHash ?? null, patch.parentCodeHash ?? null],
  );
  cache = null; // invalidate
}

/* ------------------------------ middleware ------------------------------ */

/**
 * Gate for all data routes. When an app code is set, every request must carry
 * a matching `x-app-code` header. Auth routes and the health check are mounted
 * before this, so they stay reachable while the app is locked.
 */
export async function requireAppCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { appCodeHash } = await getSettings();
    if (!appCodeHash) return next(); // no code configured yet → open
    const provided = req.header("x-app-code");
    if (provided && verifyCode(provided, appCodeHash)) return next();
    res.status(401).json({ error: "Locked", code: "APP_CODE_REQUIRED" });
  } catch (err) {
    next(err);
  }
}

/* -------------------------------- routes -------------------------------- */

export const authRouter = Router();

const MIN_LEN = 4;

// What's configured — never returns the codes themselves.
authRouter.get("/auth/status", async (_req, res) => {
  const s = await getSettings();
  res.json({ appCodeSet: !!s.appCodeHash, parentCodeSet: !!s.parentCodeHash });
});

// Check a code for a given scope ("app" or "parent").
authRouter.post("/auth/verify", async (req, res) => {
  const { code, scope } = req.body ?? {};
  const s = await getSettings();
  const hash = scope === "parent" ? s.parentCodeHash : s.appCodeHash;
  res.json({ ok: typeof code === "string" && verifyCode(code, hash) });
});

// Create or change codes. First-time setup is open (no app code yet); once an
// app code exists, any change requires the current app code.
authRouter.post("/auth/setup", async (req, res) => {
  const { appCode, parentCode, currentCode } = req.body ?? {};
  const s = await getSettings();

  if (s.appCodeHash && !verifyCode(String(currentCode ?? ""), s.appCodeHash)) {
    res.status(403).json({ error: "Wrong current access code" });
    return;
  }

  const patch: { appCodeHash?: string; parentCodeHash?: string } = {};
  if (typeof appCode === "string" && appCode.length) {
    if (appCode.length < MIN_LEN) {
      res.status(400).json({ error: `The code must be at least ${MIN_LEN} characters` });
      return;
    }
    patch.appCodeHash = hashCode(appCode);
  }
  if (typeof parentCode === "string" && parentCode.length) {
    if (parentCode.length < MIN_LEN) {
      res.status(400).json({ error: `The code must be at least ${MIN_LEN} characters` });
      return;
    }
    patch.parentCodeHash = hashCode(parentCode);
  }

  if (!patch.appCodeHash && !patch.parentCodeHash) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  await saveCodes(patch);
  const ns = await getSettings();
  res.json({ appCodeSet: !!ns.appCodeHash, parentCodeSet: !!ns.parentCodeHash });
});

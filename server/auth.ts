import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { query } from "./db";

/* --------------------------- password hashing --------------------------- */

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string | null): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pw, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* --------------------------- session signing ---------------------------- */

let secretCache: string | null = null;

async function getSecret(): Promise<string> {
  if (secretCache) return secretCache;
  const rows = await query<{ value: string }>(
    `SELECT value FROM mp_config WHERE key = 'session_secret'`,
  );
  if (rows[0]) {
    secretCache = rows[0].value;
  } else {
    const value = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
    await query(
      `INSERT INTO mp_config (key, value) VALUES ('session_secret', $1)
       ON CONFLICT (key) DO NOTHING`,
      [value],
    );
    const again = await query<{ value: string }>(
      `SELECT value FROM mp_config WHERE key = 'session_secret'`,
    );
    secretCache = again[0]?.value ?? value;
  }
  return secretCache;
}

const COOKIE = "mp_session";

async function makeToken(userId: string): Promise<string> {
  const secret = await getSecret();
  const sig = createHmac("sha256", secret).update(userId).digest("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${sig}`;
}

async function readToken(token: string): Promise<string | null> {
  const [idPart, sig] = token.split(".");
  if (!idPart || !sig) return null;
  const userId = Buffer.from(idPart, "base64url").toString();
  const secret = await getSecret();
  const expected = createHmac("sha256", secret).update(userId).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

function getCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function setSession(res: Response, userId: string) {
  res.cookie(COOKIE, await makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 180, // 180 days
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

/* ----------------------------- current user ----------------------------- */

export interface AuthUser {
  id: string;
  familyId: string;
  familyName: string;
  role: "parent" | "child";
  username: string;
  displayName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

async function currentUser(req: Request): Promise<AuthUser | null> {
  const token = getCookie(req, COOKIE);
  if (!token) return null;
  const userId = await readToken(token);
  if (!userId) return null;
  const rows = await query<AuthUser>(
    `SELECT u.id, u.family_id AS "familyId", f.name AS "familyName",
            u.role, u.username, u.display_name AS "displayName"
     FROM mp_users u JOIN mp_families f ON f.id = u.family_id
     WHERE u.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await currentUser(req);
    if (!user) {
      res.status(401).json({ error: "Not signed in", code: "AUTH_REQUIRED" });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireParent(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "parent") {
    res.status(403).json({ error: "Only a parent can do that" });
    return;
  }
  next();
}

/* ------------------------------ validation ------------------------------ */

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: "Server error" });
    });
  };

export function cleanUsername(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

// Recovery answers are matched case-insensitively and trimmed.
function normalizeAnswer(a: unknown): string {
  return String(a ?? "").trim().toLowerCase();
}

function validCredentials(username: string, password: string): string | null {
  if (username.length < 3) return "Username must be at least 3 characters";
  if (!/^[a-z0-9_.-]+$/.test(username)) return "Username can use letters, numbers, . _ - only";
  if (String(password).length < 4) return "Password must be at least 4 characters";
  return null;
}

function publicUser(u: AuthUser) {
  return {
    id: u.id,
    role: u.role,
    displayName: u.displayName,
    username: u.username,
    familyName: u.familyName,
  };
}

/* -------------------------------- routes -------------------------------- */

export const authRouter = Router();

// Register a NEW family with its first parent account.
authRouter.post(
  "/auth/register",
  h(async (req, res) => {
    const { familyName, displayName, username: rawU, password } = req.body ?? {};
    const username = cleanUsername(rawU);
    const bad = validCredentials(username, password);
    if (bad) return void res.status(400).json({ error: bad });
    if (!displayName || !String(displayName).trim())
      return void res.status(400).json({ error: "Your name is required" });

    const taken = await query(`SELECT 1 FROM mp_users WHERE username = $1`, [username]);
    if (taken.length) return void res.status(409).json({ error: "That username is taken" });

    const { randomUUID } = await import("node:crypto");
    const familyId = randomUUID();
    const famName = String(familyName || "My family").trim();
    const name = String(displayName).trim();
    await query(`INSERT INTO mp_families (id, name) VALUES ($1, $2)`, [familyId, famName]);
    const userId = randomUUID();
    const rq = typeof req.body?.recoveryQuestion === "string" ? req.body.recoveryQuestion.trim() : "";
    const ra = typeof req.body?.recoveryAnswer === "string" ? req.body.recoveryAnswer : "";
    const recoveryQuestion = rq || null;
    const recoveryAnswerHash = rq && ra.trim() ? hashPassword(normalizeAnswer(ra)) : null;
    await query(
      `INSERT INTO mp_users
        (id, family_id, role, username, password_hash, display_name, recovery_question, recovery_answer_hash)
       VALUES ($1, $2, 'parent', $3, $4, $5, $6, $7)`,
      [userId, familyId, username, hashPassword(password), name, recoveryQuestion, recoveryAnswerHash],
    );
    await setSession(res, userId);
    res.status(201).json(
      publicUser({ id: userId, familyId, familyName: famName, role: "parent", username, displayName: name }),
    );
  }),
);

authRouter.post(
  "/auth/login",
  h(async (req, res) => {
    const username = cleanUsername(req.body?.username);
    const password = String(req.body?.password ?? "");
    const rows = await query<AuthUser & { password_hash: string }>(
      `SELECT u.id, u.family_id AS "familyId", f.name AS "familyName",
              u.role, u.username, u.display_name AS "displayName", u.password_hash
       FROM mp_users u JOIN mp_families f ON f.id = u.family_id
       WHERE u.username = $1`,
      [username],
    );
    const u = rows[0];
    if (!u || !verifyPassword(password, u.password_hash)) {
      return void res.status(401).json({ error: "Wrong username or password" });
    }
    await setSession(res, u.id);
    res.json(publicUser(u));
  }),
);

authRouter.post("/auth/logout", (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

authRouter.get(
  "/auth/me",
  h(async (req, res) => {
    const user = await currentUser(req);
    if (!user) return void res.status(401).json({ error: "Not signed in", code: "AUTH_REQUIRED" });
    res.json(publicUser(user));
  }),
);

// Change your own password (you must know the current one).
authRouter.post(
  "/auth/change-password",
  requireAuth,
  h(async (req, res) => {
    const current = String(req.body?.currentPassword ?? "");
    const next = String(req.body?.newPassword ?? "");
    if (next.length < 4) return void res.status(400).json({ error: "New password must be at least 4 characters" });
    const rows = await query<{ password_hash: string }>(
      `SELECT password_hash FROM mp_users WHERE id = $1`,
      [req.user!.id],
    );
    if (!rows.length || !verifyPassword(current, rows[0].password_hash))
      return void res.status(403).json({ error: "Current password is wrong" });
    await query(`UPDATE mp_users SET password_hash = $2 WHERE id = $1`, [req.user!.id, hashPassword(next)]);
    res.json({ ok: true });
  }),
);

// Set / update your own recovery question (while signed in).
authRouter.post(
  "/auth/recovery-question",
  requireAuth,
  h(async (req, res) => {
    const question = String(req.body?.question ?? "").trim();
    const answer = String(req.body?.answer ?? "");
    if (!question || !answer.trim())
      return void res.status(400).json({ error: "Both a question and an answer are required" });
    await query(`UPDATE mp_users SET recovery_question = $2, recovery_answer_hash = $3 WHERE id = $1`, [
      req.user!.id,
      question,
      hashPassword(normalizeAnswer(answer)),
    ]);
    res.json({ ok: true });
  }),
);

// Public: the recovery question for a username (null if none is set).
authRouter.get(
  "/auth/recovery-question",
  h(async (req, res) => {
    const username = cleanUsername(req.query.username);
    if (!username) return void res.json({ question: null });
    const rows = await query<{ recovery_question: string | null; recovery_answer_hash: string | null }>(
      `SELECT recovery_question, recovery_answer_hash FROM mp_users WHERE username = $1`,
      [username],
    );
    const u = rows[0];
    res.json({ question: u && u.recovery_answer_hash ? u.recovery_question : null });
  }),
);

// Public: reset the password by answering the recovery question.
authRouter.post(
  "/auth/recover",
  h(async (req, res) => {
    const username = cleanUsername(req.body?.username);
    const answer = normalizeAnswer(req.body?.answer);
    const newPassword = String(req.body?.newPassword ?? "");
    if (newPassword.length < 4)
      return void res.status(400).json({ error: "New password must be at least 4 characters" });
    const rows = await query<AuthUser & { recovery_answer_hash: string | null }>(
      `SELECT u.id, u.family_id AS "familyId", f.name AS "familyName", u.role, u.username,
              u.display_name AS "displayName", u.recovery_answer_hash
       FROM mp_users u JOIN mp_families f ON f.id = u.family_id
       WHERE u.username = $1`,
      [username],
    );
    const u = rows[0];
    if (!u || !u.recovery_answer_hash || !verifyPassword(answer, u.recovery_answer_hash))
      return void res.status(403).json({ error: "That answer doesn't match" });
    await query(`UPDATE mp_users SET password_hash = $2 WHERE id = $1`, [u.id, hashPassword(newPassword)]);
    await setSession(res, u.id);
    res.json(publicUser(u));
  }),
);

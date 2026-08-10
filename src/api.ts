import type {
  Child,
  InvitePreview,
  MyChild,
  Service,
  Session,
  Song,
  SundaySongs,
  Summary,
  User,
} from "./types";

/** Fired when a request comes back 401 — the AuthProvider drops the user. */
export const AUTH_EXPIRED = "mp-auth-expired";

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = "Something went wrong";
    let code: string | undefined;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
      code = data?.code;
    } catch {
      /* ignore */
    }
    if (res.status === 401 && code === "AUTH_REQUIRED") {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED));
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type NewSession = Omit<Session, "id" | "childId" | "createdAt" | "updatedAt">;

export const api = {
  // ---- auth ----
  me: () => request<User>("GET", "/api/auth/me"),
  register: (data: { familyName: string; displayName: string; username: string; password: string }) =>
    request<User>("POST", "/api/auth/register", data),
  login: (data: { username: string; password: string }) =>
    request<User>("POST", "/api/auth/login", data),
  logout: () => request<void>("POST", "/api/auth/logout"),
  getInvite: (code: string) => request<InvitePreview>("GET", `/api/invite/${encodeURIComponent(code)}`),
  acceptInvite: (code: string, data: { username: string; password: string }) =>
    request<User>("POST", `/api/invite/${encodeURIComponent(code)}/accept`, data),

  // ---- children / invites (parent) ----
  listChildren: () => request<Child[]>("GET", "/api/children"),
  createChild: (data: { name: string; instrument?: string; color?: string }) =>
    request<Child>("POST", "/api/children", data),
  updateChild: (id: string, data: Partial<Pick<Child, "name" | "instrument" | "color">>) =>
    request<{ ok: true }>("PATCH", `/api/children/${id}`, data),
  deleteChild: (id: string) => request<void>("DELETE", `/api/children/${id}`),
  newInvite: (id: string) => request<{ inviteCode: string }>("POST", `/api/children/${id}/new-invite`),
  resetChildPassword: (id: string, password: string) =>
    request<{ ok: true }>("POST", `/api/children/${id}/reset-password`, { password }),
  myChild: () => request<MyChild>("GET", "/api/me/child"),

  // ---- sessions ----
  listSessions: (params: { childId?: string; date?: string; from?: string; to?: string } = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null) as [string, string][],
    ).toString();
    return request<Session[]>("GET", `/api/sessions${q ? `?${q}` : ""}`);
  },
  createSession: (data: Partial<NewSession> & { date: string }) =>
    request<Session>("POST", "/api/sessions", data),
  updateSession: (id: string, data: Partial<NewSession>) =>
    request<Session>("PATCH", `/api/sessions/${id}`, data),
  deleteSession: (id: string) => request<void>("DELETE", `/api/sessions/${id}`),

  // ---- parent summary ----
  summary: (days = 30) => request<Summary>("GET", `/api/summary?days=${days}`),

  // ---- song repertoire ----
  listSongs: (params: { q?: string; tag?: string } = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    ).toString();
    return request<Song[]>("GET", `/api/songs${q ? `?${q}` : ""}`);
  },
  songTags: () => request<string[]>("GET", "/api/song-tags"),
  createSong: (data: { title: string; tags?: string[]; notes?: string }) =>
    request<Song>("POST", "/api/songs", data),
  updateSong: (id: string, data: Partial<Pick<Song, "title" | "tags" | "notes">>) =>
    request<Song>("PATCH", `/api/songs/${id}`, data),
  deleteSong: (id: string) => request<void>("DELETE", `/api/songs/${id}`),

  // ---- Sunday services ----
  listServices: () => request<Service[]>("GET", "/api/services"),
  sundaySongs: () => request<SundaySongs>("GET", "/api/sunday-songs"),
  createService: (data: { date: string; theme?: string; notes?: string; songIds?: string[] }) =>
    request<Service>("POST", "/api/services", data),
  updateService: (
    id: string,
    data: { date?: string; theme?: string; notes?: string; songIds?: string[] },
  ) => request<Service>("PATCH", `/api/services/${id}`, data),
  deleteService: (id: string) => request<void>("DELETE", `/api/services/${id}`),
};

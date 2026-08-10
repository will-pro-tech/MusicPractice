import type { AuthStatus, Child, Service, Session, Song, Summary } from "./types";

export const APP_CODE_KEY = "appCode";

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  const appCode = localStorage.getItem(APP_CODE_KEY);
  if (appCode) headers["x-app-code"] = appCode;

  const res = await fetch(url, {
    method,
    headers,
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
    // The stored access code is missing or no longer valid — drop it and
    // send the user back to the lock screen.
    if (res.status === 401 && code === "APP_CODE_REQUIRED") {
      localStorage.removeItem(APP_CODE_KEY);
      location.reload();
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type NewSession = Omit<
  Session,
  "id" | "createdAt" | "updatedAt"
>;

export const api = {
  // children
  listChildren: () => request<Child[]>("GET", "/api/children"),
  createChild: (data: { name: string; instrument?: string; color?: string }) =>
    request<Child>("POST", "/api/children", data),
  updateChild: (id: string, data: Partial<Pick<Child, "name" | "instrument" | "color">>) =>
    request<Child>("PATCH", `/api/children/${id}`, data),
  deleteChild: (id: string) => request<void>("DELETE", `/api/children/${id}`),

  // sessions
  listSessions: (params: { childId?: string; date?: string; from?: string; to?: string } = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null) as [string, string][],
    ).toString();
    return request<Session[]>("GET", `/api/sessions${q ? `?${q}` : ""}`);
  },
  createSession: (data: Partial<NewSession> & { childId: string; date: string }) =>
    request<Session>("POST", "/api/sessions", data),
  updateSession: (id: string, data: Partial<NewSession>) =>
    request<Session>("PATCH", `/api/sessions/${id}`, data),
  deleteSession: (id: string) => request<void>("DELETE", `/api/sessions/${id}`),

  // parent summary
  summary: (days = 30) => request<Summary>("GET", `/api/summary?days=${days}`),

  // song repertoire
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

  // Sunday service planning
  listServices: () => request<Service[]>("GET", "/api/services"),
  createService: (data: { date: string; theme?: string; notes?: string; songIds?: string[] }) =>
    request<Service>("POST", "/api/services", data),
  updateService: (
    id: string,
    data: { date?: string; theme?: string; notes?: string; songIds?: string[] },
  ) => request<Service>("PATCH", `/api/services/${id}`, data),
  deleteService: (id: string) => request<void>("DELETE", `/api/services/${id}`),

  // access codes
  authStatus: () => request<AuthStatus>("GET", "/api/auth/status"),
  verifyCode: (code: string, scope: "app" | "parent") =>
    request<{ ok: boolean }>("POST", "/api/auth/verify", { code, scope }),
  setupCodes: (data: { appCode?: string; parentCode?: string; currentCode?: string }) =>
    request<AuthStatus>("POST", "/api/auth/setup", data),
};

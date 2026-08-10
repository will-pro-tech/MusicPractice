import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "./types";
import { api, AUTH_EXPIRED } from "./api";
import AuthScreens from "./AuthScreens";

interface Ctx {
  user: User;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<Ctx | null>(null);

export function useUser(): Ctx {
  const c = useContext(UserContext);
  if (!c) throw new Error("useUser must be used inside <AuthProvider>");
  return c;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED, onExpired);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  if (!ready) {
    return (
      <div className="grid min-h-full place-items-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <AuthScreens onAuthed={setUser} />;

  return <UserContext.Provider value={{ user, refresh: load, logout }}>{children}</UserContext.Provider>;
}

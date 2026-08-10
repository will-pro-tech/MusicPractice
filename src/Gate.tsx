import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Music2, Lock, ShieldCheck } from "lucide-react";
import { api, APP_CODE_KEY } from "./api";
import type { AuthStatus } from "./types";
import { Button, TextInput } from "./ui";

/**
 * Wraps the whole app. Handles first-run setup of the access code and the
 * lock screen. The children (the real app) only render once unlocked.
 */
export default function Gate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setReady(false);
    setError(null);
    try {
      const s = await api.authStatus();
      setStatus(s);
      if (!s.appCodeSet) {
        setUnlocked(false);
      } else {
        const stored = localStorage.getItem(APP_CODE_KEY);
        if (stored && (await api.verifyCode(stored, "app")).ok) {
          setUnlocked(true);
        } else {
          localStorage.removeItem(APP_CODE_KEY);
          setUnlocked(false);
        }
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (!ready) return <Splash />;
  if (error) {
    return (
      <Frame icon={<Lock size={26} />} title="Connection problem" subtitle={error}>
        <Button className="w-full" onClick={check}>
          Retry
        </Button>
      </Frame>
    );
  }
  if (status && !status.appCodeSet) return <Setup onDone={check} />;
  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  return <>{children}</>;
}

function Splash() {
  return (
    <div className="grid min-h-full place-items-center bg-neutral-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
    </div>
  );
}

function Frame({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-full place-items-center bg-neutral-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-teal-600 text-white">
            {icon}
          </div>
          <h1 className="text-xl font-bold text-neutral-800">{title}</h1>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Setup({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (code.length < 4) return setError("Use at least 4 characters.");
    if (code !== confirm) return setError("The codes don't match.");
    setBusy(true);
    setError(null);
    try {
      await api.setupCodes({ appCode: code });
      localStorage.setItem(APP_CODE_KEY, code);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  }

  return (
    <Frame
      icon={<ShieldCheck size={26} />}
      title="Create an access code"
      subtitle="Set a code so only your family can open the app."
    >
      <div className="space-y-3">
        <TextInput
          type="password"
          inputMode="text"
          autoFocus
          placeholder="New access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <TextInput
          type="password"
          placeholder="Confirm code"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Button className="w-full" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Create code"}
        </Button>
        <p className="text-center text-xs text-neutral-400">
          You can add a separate parent code later, in Parents → settings.
        </p>
      </div>
    </Frame>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const { ok } = await api.verifyCode(code, "app");
      if (ok) {
        localStorage.setItem(APP_CODE_KEY, code);
        onUnlock();
      } else {
        setError("Wrong code. Try again.");
        setBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't verify");
      setBusy(false);
    }
  }

  return (
    <Frame icon={<Music2 size={26} />} title="My Practice" subtitle="Enter your access code to continue.">
      <div className="space-y-3">
        <TextInput
          type="password"
          autoFocus
          placeholder="Access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Button className="w-full" onClick={submit} disabled={busy}>
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </div>
    </Frame>
  );
}

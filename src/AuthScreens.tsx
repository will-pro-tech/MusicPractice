import { useEffect, useState, type ReactNode } from "react";
import { Music2, UserPlus, LogIn } from "lucide-react";
import type { InvitePreview, User } from "./types";
import { api } from "./api";
import { Button, Label, TextInput } from "./ui";

type Mode = "login" | "register";

export default function AuthScreens({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("invite");
    if (code) setInviteCode(code);
  }, []);

  if (inviteCode) return <JoinScreen code={inviteCode} onAuthed={onAuthed} onBack={() => setInviteCode(null)} />;
  return <LoginRegister onAuthed={onAuthed} />;
}

function Frame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center bg-neutral-50 px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-teal-600 text-white">
            <Music2 size={26} />
          </div>
          <h1 className="text-xl font-bold text-neutral-800">{title}</h1>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoginRegister({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [familyName, setFamilyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const user =
        mode === "login"
          ? await api.login({ username, password })
          : await api.register({ familyName, displayName, username, password });
      onAuthed(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in");
      setBusy(false);
    }
  }

  return (
    <Frame
      title="My Music Practice"
      subtitle={mode === "login" ? "Sign in to your family." : "Create your family group."}
    >
      <div className="mb-4 flex rounded-full bg-neutral-200 p-1 text-sm font-semibold">
        {(["login", "register"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            className={`flex-1 rounded-full py-1.5 transition-colors ${mode === m ? "bg-white text-teal-700 shadow-sm" : "text-neutral-500"}`}
          >
            {m === "login" ? "Sign in" : "Create family"}
          </button>
        ))}
      </div>

      {/* key forces the browser to treat sign-in and sign-up as different forms */}
      <form
        key={mode}
        className="space-y-3"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        {mode === "register" && (
          <>
            <div>
              <Label>Family name</Label>
              <TextInput name="organization" autoComplete="off" value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="e.g. The Garcías" />
            </div>
            <div>
              <Label>Your name</Label>
              <TextInput name="name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. María" />
            </div>
          </>
        )}
        <div>
          <Label>Username</Label>
          <TextInput
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="letters, numbers, . _ -"
          />
        </div>
        <div>
          <Label>Password</Label>
          <TextInput
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 4 characters"
          />
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create family"}
        </Button>
        <p className="text-center text-xs text-neutral-400">
          {mode === "login"
            ? "Are you a child? Open the invite link your parent shared."
            : "Parents create the family, then invite each child."}
        </p>
      </form>
    </Frame>
  );
}

function JoinScreen({ code, onAuthed, onBack }: { code: string; onAuthed: (u: User) => void; onBack: () => void }) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getInvite(code).then(setPreview).catch(() => setInvalid(true));
  }, [code]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const user = await api.acceptInvite(code, { username, password });
      window.history.replaceState({}, "", window.location.pathname);
      onAuthed(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join");
      setBusy(false);
    }
  }

  if (invalid) {
    return (
      <Frame title="Invite not found" subtitle="This invite link is invalid or already used.">
        <Button variant="ghost" className="w-full" onClick={onBack}>Back to sign in</Button>
      </Frame>
    );
  }
  if (!preview) {
    return (
      <div className="grid min-h-full place-items-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <Frame
      title={preview.name ? `Hi, ${preview.name}!` : "Join the family"}
      subtitle={`Join ${preview.familyName}${preview.role === "parent" ? " as a parent." : " and create your login."}`}
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div>
          <Label>Choose a username</Label>
          <TextInput
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. sophia"
          />
        </div>
        <div>
          <Label>Choose a password</Label>
          <TextInput
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 4 characters"
          />
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Joining…" : "Join & start"}</Button>
        <Button variant="ghost" className="w-full" onClick={onBack}>Cancel</Button>
      </form>
    </Frame>
  );
}

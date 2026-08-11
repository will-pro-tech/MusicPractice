import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Plus, Trash2, Check, Copy, RefreshCw, KeyRound, Pencil, Link2, UserPlus } from "lucide-react";
import type { Adult, Child, ParentInvite } from "../types";
import { api } from "../api";
import { COLOR_KEYS, colorOf, initials } from "../lib";
import { Button, Card, EmptyState, Label, Spinner, TextInput } from "../ui";

function inviteLink(code: string) {
  return `${window.location.origin}/?invite=${code}`;
}

/** Small uppercase label used to separate sections on the Family page. */
function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-1 text-sm font-bold uppercase tracking-wide text-neutral-400">{children}</h2>;
}

function CopyLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={inviteLink(code)}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-600"
      />
      <button type="button" onClick={copy} className="shrink-0 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

export default function ParentChildren() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setChildren(await api.listChildren());
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-bold text-neutral-800">Family</h1>
        <p className="text-sm text-neutral-500">Manage the adults and kids in your family. Everyone signs in with their own account.</p>
      </div>

      <AdultsSection />

      <SectionLabel>Kids</SectionLabel>

      {children === null ? (
        <Spinner />
      ) : (
        <>
          {children.length === 0 && !adding && (
            <EmptyState title="No kids yet" hint="Tap “Add child” to create the first invite." />
          )}
          {children.map((c) => (
            <ChildRow key={c.id} child={c} onChanged={load} />
          ))}
        </>
      )}

      {adding ? (
        <ChildEditor
          onCancel={() => setAdding(false)}
          onSave={async (data) => {
            await api.createChild(data);
            setAdding(false);
            load();
          }}
        />
      ) : (
        <Button className="w-full" onClick={() => setAdding(true)}>
          <Plus size={18} /> Add child
        </Button>
      )}
    </div>
  );
}

function ChildRow({ child, onChanged }: { child: Child; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);
  const color = colorOf(child.color);

  if (editing) {
    return (
      <ChildEditor
        initial={child}
        onCancel={() => setEditing(false)}
        onSave={async (data) => {
          await api.updateChild(child.id, data);
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  async function copyLink() {
    if (!child.inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteLink(child.inviteCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-full text-lg font-bold ${color.bg} ${color.text}`}>
          {initials(child.name)}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-neutral-800">{child.name}</p>
          <p className="text-sm text-neutral-500">{child.instrument || "No instrument"}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${child.joined ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`}
        >
          {child.joined ? `@${child.username}` : "Invite pending"}
        </span>
      </div>

      {!child.joined && child.inviteCode && (
        <div className="rounded-xl bg-neutral-50 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link2 size={13} /> Invite link
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteLink(child.inviteCode)}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-600"
            />
            <button type="button" onClick={copyLink} className="shrink-0 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <RowAction icon={<Pencil size={14} />} onClick={() => setEditing(true)}>Edit</RowAction>
        {!child.joined && (
          <RowAction
            icon={<RefreshCw size={14} />}
            onClick={async () => {
              await api.newInvite(child.id);
              onChanged();
            }}
          >
            New link
          </RowAction>
        )}
        {child.joined && (
          <RowAction icon={<KeyRound size={14} />} onClick={() => setResetting(true)}>Reset password</RowAction>
        )}
        <RowAction
          danger
          icon={<Trash2 size={14} />}
          onClick={async () => {
            if (confirm(`Remove ${child.name} and all their practices?`)) {
              await api.deleteChild(child.id);
              onChanged();
            }
          }}
        >
          Delete
        </RowAction>
      </div>

      {resetting && (
        <ResetPassword
          name={child.name}
          onReset={(pw) => api.resetChildPassword(child.id, pw)}
          onDone={() => setResetting(false)}
        />
      )}
    </Card>
  );
}

function RowAction({
  children, icon, onClick, danger,
}: {
  children: React.ReactNode; icon: React.ReactNode; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium ${danger ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
    >
      {icon} {children}
    </button>
  );
}

function ResetPassword({
  name,
  onReset,
  onDone,
}: {
  name: string;
  onReset: (pw: string) => Promise<unknown>;
  onDone: () => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (pw.length < 4) return setMsg("At least 4 characters.");
    setBusy(true);
    try {
      await onReset(pw);
      setMsg("Password updated.");
      setPw("");
      setTimeout(onDone, 900);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't update");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <Label>New password for {name}</Label>
      <div className="flex items-center gap-2">
        <TextInput type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 4 characters" />
        <Button onClick={submit} disabled={busy} className="shrink-0">Save</Button>
      </div>
      {msg && <p className="mt-1 text-sm text-neutral-600">{msg}</p>}
    </div>
  );
}

function ChildEditor({
  initial, onSave, onCancel,
}: {
  initial?: Child;
  onSave: (data: { name: string; instrument: string; color: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [instrument, setInstrument] = useState(initial?.instrument ?? "");
  const [color, setColor] = useState(initial?.color ?? "teal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return setError("Name is required");
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), instrument: instrument.trim(), color });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <Label>Name</Label>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sophia" />
      </div>
      <div>
        <Label>Instrument</Label>
        <TextInput value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="e.g. Violin" />
      </div>
      <div>
        <Label>Color</Label>
        <div className="flex gap-2">
          {COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              className={`grid h-9 w-9 place-items-center rounded-full ${colorOf(key).dot} ${color === key ? "ring-2 ring-neutral-800 ring-offset-2" : ""}`}
            >
              {color === key && <Check size={16} className="text-white" />}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </Card>
  );
}

function AdultsSection() {
  const [adults, setAdults] = useState<Adult[] | null>(null);
  const [invites, setInvites] = useState<ParentInvite[]>([]);
  const [inviting, setInviting] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);

  async function load() {
    const [a, i] = await Promise.all([api.listParents(), api.listParentInvites()]);
    setAdults(a);
    setInvites(i);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-2">
      <SectionLabel>Adults</SectionLabel>

      {adults === null ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {adults.map((a) => (
            <div key={a.id} className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-black/5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                  {initials(a.displayName)}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-800">
                    {a.displayName}
                    {a.isSelf && <span className="ml-1 text-xs font-normal text-neutral-400">(you)</span>}
                  </p>
                  <p className="text-xs text-neutral-500">@{a.username}</p>
                </div>
                {!a.isSelf && (
                  <>
                    <button
                      type="button"
                      onClick={() => setResetId(resetId === a.id ? null : a.id)}
                      title="Reset password"
                      className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    >
                      <KeyRound size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Remove ${a.displayName} from the family?`)) {
                          await api.removeParent(a.id);
                          load();
                        }
                      }}
                      className="rounded-full p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
              {resetId === a.id && (
                <ResetPassword
                  name={a.displayName}
                  onReset={(pw) => api.resetParentPassword(a.id, pw)}
                  onDone={() => setResetId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {invites.map((inv) => (
        <div key={inv.code} className="rounded-xl bg-amber-50 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">
              {inv.displayName ? `Invite for ${inv.displayName}` : "Adult invite"} · pending
            </span>
            <button
              type="button"
              onClick={async () => {
                await api.deleteParentInvite(inv.code);
                load();
              }}
              className="rounded-full p-1 text-amber-700 hover:bg-amber-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <CopyLink code={inv.code} />
        </div>
      ))}

      {inviting ? (
        <InviteAdultForm
          onCancel={() => setInviting(false)}
          onDone={() => {
            setInviting(false);
            load();
          }}
        />
      ) : (
        <Button className="w-full" onClick={() => setInviting(true)}>
          <UserPlus size={18} /> Invite adult
        </Button>
      )}
    </div>
  );
}

function InviteAdultForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <Label>Name of the adult (optional)</Label>
      <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gaby (band director)" />
      <div className="mt-2 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button
          className="flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.createParentInvite(name.trim());
              onDone();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating…" : "Create invite link"}
        </Button>
      </div>
    </div>
  );
}

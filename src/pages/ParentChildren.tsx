import { useEffect, useState } from "react";
import { Plus, Trash2, Check, Copy, RefreshCw, KeyRound, Pencil, Link2 } from "lucide-react";
import type { Child } from "../types";
import { api } from "../api";
import { COLOR_KEYS, colorOf, initials } from "../lib";
import { Button, Card, EmptyState, Label, Spinner, TextInput } from "../ui";

function inviteLink(code: string) {
  return `${window.location.origin}/?invite=${code}`;
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
        <h1 className="text-xl font-bold text-neutral-800">Kids</h1>
        <p className="text-sm text-neutral-500">Add each child, then share their invite link so they can create their own login.</p>
      </div>

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

      {resetting && <ResetPassword childId={child.id} name={child.name} onDone={() => setResetting(false)} />}
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

function ResetPassword({ childId, name, onDone }: { childId: string; name: string; onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (pw.length < 4) return setMsg("At least 4 characters.");
    setBusy(true);
    try {
      await api.resetChildPassword(childId, pw);
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

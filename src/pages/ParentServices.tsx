import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, Check, GripVertical, CalendarDays } from "lucide-react";
import type { Service, Song } from "../types";
import { api } from "../api";
import { formatDate, todayISO } from "../lib";
import { Button, Card, EmptyState, Label, Spinner, TextArea, TextInput } from "../ui";
import { TagFilter, TagChips } from "../tags";

export default function ParentServices() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [editing, setEditing] = useState<Service | "new" | null>(null);

  async function load() {
    setServices(await api.listServices());
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-xl font-bold text-neutral-800">Sundays</h1>
          <p className="text-sm text-neutral-500">Plan each service's songs by theme.</p>
        </div>
        <Button onClick={() => setEditing("new")} className="px-3">
          <Plus size={18} />
        </Button>
      </div>

      {services === null ? (
        <Spinner />
      ) : services.length === 0 ? (
        <EmptyState title="No services planned yet" hint="Tap + to plan a Sunday." />
      ) : (
        services.map((s) => (
          <Card key={s.id} className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-100 text-teal-700">
                  <CalendarDays size={18} />
                </span>
                <div>
                  <p className="font-bold text-neutral-800">{formatDate(s.date)}</p>
                  {s.theme && <p className="text-sm text-teal-700">Theme: {s.theme}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setEditing(s)} className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Delete this service?")) {
                      await api.deleteService(s.id);
                      load();
                    }
                  }}
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {s.songs.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-400">No songs yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {s.songs.map((song, i) => (
                  <li key={song.id} className="rounded-xl bg-neutral-50 px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-neutral-400">{i + 1}.</span>
                      <span className="font-medium text-neutral-800">{song.title}</span>
                    </div>
                    {song.tags.length > 0 && (
                      <div className="mt-1 pl-5">
                        <TagChips tags={song.tags} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {s.notes && <p className="text-sm text-neutral-500">📝 {s.notes}</p>}
          </Card>
        ))
      )}

      {editing && (
        <ServiceEditor
          service={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ServiceEditor({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(service?.date ?? todayISO());
  const [theme, setTheme] = useState(service?.theme ?? "");
  const [notes, setNotes] = useState(service?.notes ?? "");
  const [selected, setSelected] = useState<{ id: string; title: string }[]>(
    service?.songs.filter((s) => s.songId).map((s) => ({ id: s.songId as string, title: s.title })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(song: Song) {
    setSelected((prev) =>
      prev.some((p) => p.id === song.id)
        ? prev.filter((p) => p.id !== song.id)
        : [...prev, { id: song.id, title: song.title }],
    );
  }
  function move(id: string, dir: -1 | 1) {
    setSelected((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = { date, theme, notes, songIds: selected.map((s) => s.id) };
    try {
      if (service) await api.updateService(service.id, payload);
      else await api.createService(payload);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl bg-neutral-50 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <h2 className="text-lg font-bold text-neutral-800">{service ? "Edit service" : "Plan Sunday"}</h2>
          <button type="button" onClick={onClose} className="text-sm font-medium text-neutral-500">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Theme</Label>
              <TextInput value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Gratitude" />
            </div>
          </div>

          {selected.length > 0 && (
            <div>
              <Label>Service order ({selected.length})</Label>
              <ol className="space-y-1.5">
                {selected.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                    <span className="text-sm font-bold text-neutral-400">{i + 1}.</span>
                    <span className="flex-1 font-medium text-neutral-800">{s.title}</span>
                    <button type="button" onClick={() => move(s.id, -1)} disabled={i === 0} className="p-1 text-neutral-400 disabled:opacity-30">▲</button>
                    <button type="button" onClick={() => move(s.id, 1)} disabled={i === selected.length - 1} className="p-1 text-neutral-400 disabled:opacity-30">▼</button>
                    <GripVertical size={16} className="text-neutral-300" />
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <Label>Add from repertoire</Label>
            <SongMultiSelect selectedIds={selected.map((s) => s.id)} onToggle={toggle} />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Directions, keys…" />
          </div>

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        </div>

        <div className="flex gap-3 border-t border-black/5 p-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save service"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SongMultiSelect({
  selectedIds,
  onToggle,
}: {
  selectedIds: string[];
  onToggle: (song: Song) => void;
}) {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    api.songTags().then(setAllTags);
  }, []);
  useEffect(() => {
    let live = true;
    api.listSongs({ q, tag: tag ?? undefined }).then((s) => live && setSongs(s));
    return () => {
      live = false;
    };
  }, [q, tag]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3">
        <Search size={16} className="text-neutral-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 bg-transparent py-2 text-sm outline-none"
        />
      </div>
      <TagFilter tags={allTags} active={tag} onSelect={setTag} />
      <div className="max-h-64 space-y-1.5 overflow-y-auto">
        {songs === null ? (
          <p className="py-4 text-center text-sm text-neutral-400">Loading…</p>
        ) : songs.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">
            No songs. Add them in the Repertoire tab.
          </p>
        ) : (
          songs.map((s) => {
            const on = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggle(s)}
                className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left ring-1 transition-colors ${
                  on ? "bg-teal-50 ring-teal-300" : "bg-white ring-black/5"
                }`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${on ? "border-teal-500 bg-teal-500 text-white" : "border-neutral-300"}`}>
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="flex-1">
                  <span className="font-medium text-neutral-800">{s.title}</span>
                  <span className="mt-0.5 block">
                    <TagChips tags={s.tags} />
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

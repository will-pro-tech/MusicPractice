import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { Song } from "../types";
import { api } from "../api";
import { Button, Card, EmptyState, Label, Spinner, TextArea, TextInput } from "../ui";
import { TagFilter, TagChips, TagInput } from "../tags";

export default function ParentRepertoire() {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<Song | "new" | null>(null);

  const loadTags = useCallback(() => api.songTags().then(setAllTags), []);
  const load = useCallback(async () => {
    setSongs(await api.listSongs({ q, tag: tag ?? undefined }));
  }, [q, tag]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadTags();
  }, [loadTags]);

  function refresh() {
    load();
    loadTags();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-xl font-bold text-neutral-800">Repertoire</h1>
          <p className="text-sm text-neutral-500">Songs kids and the band can choose from.</p>
        </div>
        <Button onClick={() => setEditing("new")} className="px-3">
          <Plus size={18} />
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3">
        <Search size={16} className="text-neutral-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search song…"
          className="flex-1 bg-transparent py-2.5 text-sm outline-none"
        />
      </div>
      <TagFilter tags={allTags} active={tag} onSelect={setTag} />

      {songs === null ? (
        <Spinner />
      ) : songs.length === 0 ? (
        <EmptyState
          title={q || tag ? "No songs match" : "No songs yet"}
          hint={q || tag ? undefined : "Tap + to add the first one."}
        />
      ) : (
        songs.map((s) => (
          <Card key={s.id} className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-semibold text-neutral-800">{s.title}</p>
              {s.notes && <p className="mt-0.5 text-sm text-neutral-500">{s.notes}</p>}
              <div className="mt-1.5">
                <TagChips tags={s.tags} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button type="button" onClick={() => setEditing(s)} className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`Remove “${s.title}” from the repertoire?`)) {
                    await api.deleteSong(s.id);
                    refresh();
                  }
                }}
                className="rounded-full p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))
      )}

      {editing && (
        <SongEditor
          song={editing === "new" ? null : editing}
          suggestions={allTags}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function SongEditor({
  song,
  suggestions,
  onClose,
  onSaved,
}: {
  song: Song | null;
  suggestions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(song?.title ?? "");
  const [tags, setTags] = useState<string[]>(song?.tags ?? []);
  const [notes, setNotes] = useState(song?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (song) await api.updateSong(song.id, { title: title.trim(), tags, notes });
      else await api.createSong({ title: title.trim(), tags, notes });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-neutral-50 p-4 sm:rounded-3xl">
        <h2 className="mb-3 text-lg font-bold text-neutral-800">
          {song ? "Edit song" : "New song"}
        </h2>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Great Is Thy Faithfulness" />
          </div>
          <div>
            <Label>Themes / tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
            <p className="mt-1 text-xs text-neutral-400">e.g. worship, gratitude, Christmas, communion…</p>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Key, author, link…" />
          </div>
          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

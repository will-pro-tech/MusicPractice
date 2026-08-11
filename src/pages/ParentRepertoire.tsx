import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { Song } from "../types";
import { api } from "../api";
import { Button, EmptyState, Label, Spinner, TextArea, TextInput } from "../ui";
import { TagFilter, TagInput } from "../tags";

export default function ParentRepertoire() {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<Song | "new" | null>(null);
  const [page, setPage] = useState(0);

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
  // Back to the first page whenever the filter changes.
  useEffect(() => {
    setPage(0);
  }, [q, tag]);

  function refresh() {
    load();
    loadTags();
  }

  // Paginate in blocks so a long repertoire doesn't stretch the page.
  const PAGE_SIZE = 25;
  const total = songs?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const shown = songs ? songs.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-xl font-bold text-neutral-800">Repertoire</h1>
          <p className="text-sm text-neutral-500">
            {songs ? `${songs.length} song${songs.length === 1 ? "" : "s"}` : "Songs kids and the band can choose from."}
            {tag ? ` · ${tag}` : ""}
          </p>
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

      {/* Themes on a single swipeable line — no big wrapping block. */}
      <TagFilter tags={allTags} active={tag} onSelect={setTag} scroll />

      {songs === null ? (
        <Spinner />
      ) : songs.length === 0 ? (
        <EmptyState
          title={q || tag ? "No songs match" : "No songs yet"}
          hint={q || tag ? undefined : "Tap + to add the first one."}
        />
      ) : (
        <>
          <div className="space-y-2">
            {shown.map((s) => (
              <SongRow key={s.id} song={s} onEdit={() => setEditing(s)} onDeleted={refresh} />
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-1 pt-1">
              <button
                type="button"
                onClick={() => { setPage(current - 1); window.scrollTo({ top: 0 }); }}
                disabled={current === 0}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 ring-1 ring-black/10 disabled:opacity-40"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="text-xs text-neutral-500">
                {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <button
                type="button"
                onClick={() => { setPage(current + 1); window.scrollTo({ top: 0 }); }}
                disabled={current >= pageCount - 1}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 ring-1 ring-black/10 disabled:opacity-40"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
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

/** One compact line per song: title, then artist + themes in small muted text. */
function SongRow({ song, onEdit, onDeleted }: { song: Song; onEdit: () => void; onDeleted: () => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white px-3 py-2.5 ring-1 ring-black/5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-800">{song.title}</p>
        {(song.notes || song.tags.length > 0) && (
          <p className="mt-0.5 truncate text-xs text-neutral-400">
            {song.notes}
            {song.notes && song.tags.length > 0 ? " · " : ""}
            {song.tags.map((t) => `#${t}`).join(" ")}
          </p>
        )}
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
        <Pencil size={15} />
      </button>
      <button
        type="button"
        onClick={async () => {
          if (confirm(`Remove “${song.title}” from the repertoire?`)) {
            await api.deleteSong(song.id);
            onDeleted();
          }
        }}
        className="shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 size={15} />
      </button>
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
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-neutral-50 sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-black/5 bg-neutral-50/95 px-4 py-3 backdrop-blur">
          <h2 className="text-lg font-bold text-neutral-800">{song ? "Edit song" : "New song"}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-200">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <Label>Name</Label>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Great Is Thy Faithfulness" />
          </div>
          <div>
            <Label>Themes / tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
            <p className="mt-1 text-xs text-neutral-400">e.g. adoración, gratitud, gracia, entrega…</p>
          </div>
          <div>
            <Label>Notes (artist, key, link…)</Label>
            <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Danilo Montero" />
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

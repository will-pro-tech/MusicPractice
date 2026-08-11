import { useEffect, useState } from "react";
import { Search, X, Check, Music } from "lucide-react";
import type { Song } from "./types";
import { api } from "./api";
import { cn } from "./lib";
import { TagFilter, TagChips } from "./tags";

/**
 * Single-song selector backed by the shared repertoire. Children tap it to
 * choose a song by name or theme; a free-text fallback lets them enter a
 * song that isn't in the library yet. The chosen title is returned as a string.
 */
export default function SongPicker({
  value,
  onChange,
  placeholder = "Choose a song…",
  accent = "text-amber-600",
}: {
  value: string;
  onChange: (title: string) => void;
  placeholder?: string;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-left"
      >
        <Music size={16} className={accent} />
        <span className={cn("flex-1 truncate", value ? "text-neutral-900" : "text-neutral-400")}>
          {value || placeholder}
        </span>
        {value && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="text-neutral-400 hover:text-neutral-700"
          >
            <X size={16} />
          </span>
        )}
      </button>

      {open && (
        <PickerSheet
          current={value}
          onClose={() => setOpen(false)}
          onPick={(title) => {
            onChange(title);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function PickerSheet({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (title: string) => void;
  onClose: () => void;
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl bg-neutral-50 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <h3 className="font-bold text-neutral-800">Choose from repertoire</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-200">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3">
            <Search size={16} className="text-neutral-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name…"
              className="flex-1 bg-transparent py-2.5 text-sm outline-none"
            />
          </div>
          <TagFilter tags={allTags} active={tag} onSelect={setTag} scroll />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {songs === null ? (
            <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>
          ) : songs.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">
              No songs {q || tag ? "match" : "yet"}. You can type one below.
            </p>
          ) : (
            songs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s.title)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 transition-colors",
                  current === s.title ? "ring-teal-400" : "ring-black/5 hover:ring-teal-200",
                )}
              >
                <div className="flex-1">
                  <p className="font-semibold text-neutral-800">{s.title}</p>
                  <div className="mt-1">
                    <TagChips tags={s.tags} />
                  </div>
                </div>
                {current === s.title && <Check size={18} className="text-teal-600" />}
              </button>
            ))
          )}
        </div>

        <FreeText onUse={onPick} />
      </div>
    </div>
  );
}

function FreeText({ onUse }: { onUse: (title: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="border-t border-black/5 bg-white p-4">
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="…or type another song"
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
        />
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => onUse(text.trim())}
          className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-teal-300"
        >
          Use
        </button>
      </div>
    </div>
  );
}

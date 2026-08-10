import { useEffect, useState } from "react";
import { Dumbbell, Church, Music4, X, Check, CalendarDays } from "lucide-react";
import type { Session, SundaySongs } from "./types";
import { api, type NewSession } from "./api";
import { todayISO, formatDate, cn } from "./lib";
import { Button, Label, TextArea, TextInput } from "./ui";
import SongPicker from "./SongPicker";
import { TagChips } from "./tags";

interface Props {
  initial?: Session | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function SessionForm({ initial, onClose, onSaved }: Props) {
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [time, setTime] = useState(initial?.time ?? "");
  const [exercisesNote, setExercisesNote] = useState(initial?.exercisesNote ?? "");
  const [churchSong, setChurchSong] = useState(initial?.churchSong ?? "");
  const [newSong, setNewSong] = useState(initial?.newSong ?? "");
  const [newSongGoal, setNewSongGoal] = useState(initial?.newSongGoal ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload: Partial<NewSession> = {
      date, time: time || null, exercisesNote, churchSong, newSong, newSongGoal, notes,
    };
    try {
      if (initial) await api.updateSession(initial.id, payload);
      else await api.createSession({ date, ...payload });
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
          <h2 className="text-lg font-bold text-neutral-800">{initial ? "Edit practice" : "Plan practice"}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-200">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Day</Label>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Time</Label>
              <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <div className="mb-2 flex items-center gap-2 font-semibold text-teal-700">
              <Dumbbell size={18} /> Exercises
            </div>
            <TextInput
              placeholder="e.g. scales, technique, arpeggios…"
              value={exercisesNote}
              onChange={(e) => setExercisesNote(e.target.value)}
            />
          </div>

          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <div className="mb-2 flex items-center gap-2 font-semibold text-amber-700">
              <Church size={18} /> Church song
            </div>
            <ChurchSongPicker value={churchSong} onChange={setChurchSong} />
          </div>

          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <div className="mb-2 flex items-center gap-2 font-semibold text-violet-700">
              <Music4 size={18} /> New song
            </div>
            <Label>Song name (optional)</Label>
            <SongPicker
              value={newSong}
              onChange={setNewSong}
              placeholder="Choose or type a song…"
              accent="text-violet-600"
            />
            <div className="mt-3">
              <Label>Today's specific goal</Label>
              <TextArea
                rows={2}
                placeholder="e.g. master the first two lines of the sheet music"
                value={newSongGoal}
                onChange={(e) => setNewSongGoal(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <TextArea rows={2} placeholder="Anything you want to remember…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

          <div className="flex gap-3 pb-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Church song must be one of the songs the adult picked for Sunday. If the
 * current value isn't in that list (e.g. an older plan), it's still shown.
 */
function ChurchSongPicker({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const [data, setData] = useState<SundaySongs | null>(null);

  useEffect(() => {
    api.sundaySongs().then(setData).catch(() => setData({ service: null, songs: [] }));
  }, []);

  if (!data) return <p className="py-2 text-sm text-neutral-400">Loading Sunday's songs…</p>;

  if (data.songs.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
        No songs picked for Sunday yet. Ask your parent to choose this Sunday's songs.
      </p>
    );
  }

  return (
    <div>
      {data.service && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500">
          <CalendarDays size={13} /> For {formatDate(data.service.date)}
          {data.service.theme ? ` · ${data.service.theme}` : ""}
        </p>
      )}
      <div className="space-y-1.5">
        {data.songs.map((s) => {
          const on = value === s.title;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(on ? "" : s.title)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl p-2.5 text-left ring-1 transition-colors",
                on ? "bg-amber-50 ring-amber-300" : "bg-white ring-black/5 hover:ring-amber-200",
              )}
            >
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", on ? "border-amber-500 bg-amber-500 text-white" : "border-neutral-300")}>
                {on && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="flex-1">
                <span className="font-medium text-neutral-800">{s.title}</span>
                <span className="mt-0.5 block"><TagChips tags={s.tags} /></span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

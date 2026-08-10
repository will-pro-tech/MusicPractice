import { useState } from "react";
import { Dumbbell, Church, Music4, X } from "lucide-react";
import type { Child, Session } from "./types";
import { api, type NewSession } from "./api";
import { todayISO } from "./lib";
import { Button, Label, TextArea, TextInput } from "./ui";
import SongPicker from "./SongPicker";

interface Props {
  child: Child;
  initial?: Session | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * The single form used to plan a new practice or edit an existing one.
 * Goals come first; time is optional and never the focus.
 */
export default function SessionForm({ child, initial, onClose, onSaved }: Props) {
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
      date,
      time: time || null,
      exercisesNote,
      churchSong,
      newSong,
      newSongGoal,
      notes,
    };
    try {
      if (initial) {
        await api.updateSession(initial.id, payload);
      } else {
        await api.createSession({ childId: child.id, date, ...payload });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-neutral-50 sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-black/5 bg-neutral-50/95 px-4 py-3 backdrop-blur">
          <h2 className="text-lg font-bold text-neutral-800">
            {initial ? "Editar práctica" : "Planear práctica"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-200">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Día</Label>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Hora</Label>
              <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <div className="mb-2 flex items-center gap-2 font-semibold text-teal-700">
              <Dumbbell size={18} /> Ejercicios
            </div>
            <TextInput
              placeholder="Ej. escalas, técnica, arpegios…"
              value={exercisesNote}
              onChange={(e) => setExercisesNote(e.target.value)}
            />
          </div>

          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <div className="mb-2 flex items-center gap-2 font-semibold text-amber-700">
              <Church size={18} /> Canción del repertorio (iglesia)
            </div>
            <Label>Nombre de la canción</Label>
            <SongPicker
              value={churchSong}
              onChange={setChurchSong}
              placeholder="Elegir del repertorio…"
              accent="text-amber-600"
            />
          </div>

          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <div className="mb-2 flex items-center gap-2 font-semibold text-violet-700">
              <Music4 size={18} /> Canción nueva
            </div>
            <Label>Nombre de la canción (opcional)</Label>
            <SongPicker
              value={newSong}
              onChange={setNewSong}
              placeholder="Elegir o escribir canción…"
              accent="text-violet-600"
            />
            <div className="mt-3">
              <Label>Meta específica de hoy</Label>
              <TextArea
                rows={2}
                placeholder="Ej. dominar las dos primeras líneas de la partitura"
                value={newSongGoal}
                onChange={(e) => setNewSongGoal(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Notas (opcional)</Label>
            <TextArea
              rows={2}
              placeholder="Algo que quieras recordar…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

          <div className="flex gap-3 pb-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

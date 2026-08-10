import { useState } from "react";
import { Dumbbell, Church, Music4, Pencil, Trash2, Clock } from "lucide-react";
import type { Session } from "./types";
import { api } from "./api";
import { formatDate, formatTime, relativeDay } from "./lib";
import { CheckRow } from "./ui";

interface Props {
  session: Session;
  onChanged: () => void;
  onEdit: (s: Session) => void;
  showDate?: boolean;
}

export default function SessionCard({ session, onChanged, onEdit, showDate }: Props) {
  const [busy, setBusy] = useState(false);

  async function patch(data: Partial<Session>) {
    setBusy(true);
    try {
      await api.updateSession(session.id, data);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("¿Eliminar esta práctica?")) return;
    await api.deleteSession(session.id);
    onChanged();
  }

  const rel = relativeDay(session.date);

  return (
    <div className={`space-y-2 rounded-3xl bg-white/70 p-3 ring-1 ring-black/5 ${busy ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          {showDate && <span>{rel ?? formatDate(session.date)}</span>}
          {session.time && (
            <span className="inline-flex items-center gap-1 text-neutral-500">
              <Clock size={13} /> {formatTime(session.time)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onEdit(session)} className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <Pencil size={16} />
          </button>
          <button type="button" onClick={remove} className="rounded-full p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <CheckRow
        checked={session.exercisesDone}
        onToggle={() => patch({ exercisesDone: !session.exercisesDone })}
        icon={<Dumbbell size={18} />}
        accent="text-teal-600"
        title="Ejercicios"
      >
        {session.exercisesNote || <span className="text-neutral-400">Sin detalle</span>}
      </CheckRow>

      <CheckRow
        checked={session.churchDone}
        onToggle={() => patch({ churchDone: !session.churchDone })}
        icon={<Church size={18} />}
        accent="text-amber-600"
        title="Canción de la iglesia"
      >
        {session.churchSong ? (
          <span className="font-medium text-neutral-700">🎵 {session.churchSong}</span>
        ) : (
          <span className="text-neutral-400">Aún sin nombre de canción</span>
        )}
      </CheckRow>

      <CheckRow
        checked={session.newSongGoalMet}
        onToggle={() => patch({ newSongGoalMet: !session.newSongGoalMet })}
        icon={<Music4 size={18} />}
        accent="text-violet-600"
        title="Canción nueva — meta cumplida"
      >
        {session.newSong && <div className="font-medium text-neutral-700">🎼 {session.newSong}</div>}
        {session.newSongGoal ? (
          <div className="mt-0.5">
            <span className="text-neutral-400">Meta: </span>
            {session.newSongGoal}
          </div>
        ) : (
          <span className="text-neutral-400">Sin meta definida</span>
        )}
      </CheckRow>

      {session.notes && (
        <p className="px-2 pt-1 text-sm text-neutral-500">📝 {session.notes}</p>
      )}
    </div>
  );
}

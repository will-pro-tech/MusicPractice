import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Church, Music4 } from "lucide-react";
import type { Session } from "../types";
import { api } from "../api";
import { formatDate, formatTime, relativeDay, cn } from "../lib";
import { EmptyState, Spinner } from "../ui";
import { usePager, Pager } from "../pager";
import SessionCard from "../SessionCard";
import SessionForm from "../SessionForm";

export default function ChildHistory() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [edit, setEdit] = useState<Session | null>(null);

  const load = useCallback(async () => {
    setSessions(await api.listSessions());
  }, []);

  useEffect(() => {
    setSessions(null);
    load();
  }, [load]);

  const { page, setPage, pageCount, total, size, pageItems } = usePager(sessions, 25);

  return (
    <div className="space-y-3">
      <h1 className="px-1 text-xl font-bold text-neutral-800">My history</h1>

      {sessions === null ? (
        <Spinner />
      ) : sessions.length === 0 ? (
        <EmptyState title="No practices logged yet" />
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map((s) => (
              <HistoryRow key={s.id} session={s} onChanged={load} onEdit={setEdit} />
            ))}
          </div>
          <Pager page={page} pageCount={pageCount} total={total} size={size} onPage={setPage} />
        </>
      )}

      {edit && (
        <SessionForm
          initial={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/** Compact, glanceable row that expands into the full editable card. */
function HistoryRow({
  session,
  onChanged,
  onEdit,
}: {
  session: Session;
  onChanged: () => void;
  onEdit: (s: Session) => void;
}) {
  const [open, setOpen] = useState(false);
  const rel = relativeDay(session.date);

  if (open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(false)} className="mb-1 flex w-full items-center gap-1 px-1 text-sm font-semibold text-teal-700">
          <ChevronDown size={16} className="rotate-180" /> {rel ?? formatDate(session.date)}
        </button>
        <SessionCard session={session} onChanged={onChanged} onEdit={onEdit} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-black/5"
    >
      <div className="w-16 shrink-0">
        <p className="text-sm font-bold text-neutral-800">{rel ?? formatDate(session.date)}</p>
        {session.time && <p className="text-xs text-neutral-400">{formatTime(session.time)}</p>}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <Mini done={session.churchDone} accent="text-amber-600" icon={<Church size={12} />} text={session.churchSong || "Church song"} />
        <Mini
          done={session.newSongGoalMet}
          accent="text-violet-600"
          icon={<Music4 size={12} />}
          text={session.newSong || session.newSongGoal || "New song"}
        />
      </div>
      <StatusDots session={session} />
      <ChevronDown size={16} className="shrink-0 text-neutral-300" />
    </button>
  );
}

function Mini({
  done,
  icon,
  text,
  accent,
}: {
  done: boolean;
  icon: React.ReactNode;
  text: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-1.5 truncate text-sm">
      <span className={cn("shrink-0", accent)}>{icon}</span>
      <span className={cn("truncate", done ? "text-neutral-700" : "text-neutral-400")}>{text}</span>
    </div>
  );
}

function StatusDots({ session }: { session: Session }) {
  const parts = [
    { on: session.exercisesDone, title: "Exercises" },
    { on: session.churchDone, title: "Church" },
    { on: session.newSongGoalMet, title: "New song goal" },
  ];
  return (
    <div className="flex shrink-0 gap-1" aria-hidden>
      {parts.map((p, i) => (
        <span key={i} title={p.title} className={cn("h-2.5 w-2.5 rounded-full", p.on ? "bg-teal-500" : "bg-neutral-200")} />
      ))}
    </div>
  );
}

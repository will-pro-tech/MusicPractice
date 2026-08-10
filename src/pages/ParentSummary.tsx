import { useEffect, useState } from "react";
import { Dumbbell, Church, Music4, CheckCircle2, Circle } from "lucide-react";
import type { ChildSummary, Summary, Session } from "../types";
import { api } from "../api";
import { colorOf, formatDate, formatTime, initials, relativeDay, todayISO } from "../lib";
import { Card, EmptyState, Spinner } from "../ui";

const WINDOW_DAYS = 30;

export default function ParentSummary() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    api.summary(WINDOW_DAYS).then(setData);
  }, []);

  if (!data) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-bold text-neutral-800">Resumen de práctica</h1>
        <p className="text-sm text-neutral-500">Metas y progreso de cada hijo — últimos {WINDOW_DAYS} días.</p>
      </div>

      {data.children.length === 0 ? (
        <EmptyState
          title="Aún no hay hijos configurados"
          hint="Ve a la pestaña “Niños” para agregarlos."
        />
      ) : (
        data.children.map((cs) => <ChildCard key={cs.child.id} summary={cs} />)
      )}
    </div>
  );
}

function ChildCard({ summary }: { summary: ChildSummary }) {
  const { child, daysPracticed, sessions } = summary;
  const color = colorOf(child.color);
  const recent = sessions.slice(0, 4);

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-full text-lg font-bold ${color.bg} ${color.text}`}>
          {initials(child.name)}
        </div>
        <div className="flex-1">
          <p className="font-bold text-neutral-800">{child.name}</p>
          {child.instrument && <p className="text-sm text-neutral-500">{child.instrument}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-neutral-800">{daysPracticed}</p>
          <p className="text-xs text-neutral-500">días con práctica</p>
        </div>
      </div>

      <ConsistencyStrip sessions={sessions} dot={color.dot} />

      {recent.length === 0 ? (
        <p className="rounded-xl bg-neutral-50 px-3 py-4 text-center text-sm text-neutral-400">
          Sin prácticas registradas todavía.
        </p>
      ) : (
        <div className="space-y-2">
          {recent.map((s) => (
            <SummaryRow key={s.id} session={s} />
          ))}
        </div>
      )}
    </Card>
  );
}

/** Last 7 days as dots — filled if the child practiced that day. */
function ConsistencyStrip({ sessions, dot }: { sessions: Session[]; dot: string }) {
  const practiced = new Set(sessions.map((s) => s.date));
  const days: { iso: string; label: string }[] = [];
  const [y, m, d] = todayISO().split("-").map(Number);
  const names = ["D", "L", "M", "M", "J", "V", "S"];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(y, m - 1, d - i);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    days.push({ iso, label: names[date.getDay()] });
  }
  return (
    <div className="flex items-center justify-between px-1">
      {days.map((day, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className={`h-6 w-6 rounded-full ${practiced.has(day.iso) ? dot : "bg-neutral-200"}`} />
          <span className="text-[10px] text-neutral-400">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ session }: { session: Session }) {
  const rel = relativeDay(session.date);
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-neutral-700">
        <span>{rel ?? formatDate(session.date)}</span>
        {session.time && <span className="font-normal text-neutral-400">· {formatTime(session.time)}</span>}
      </div>
      <div className="space-y-1 text-sm">
        <Line done={session.exercisesDone} icon={<Dumbbell size={14} />}>
          Ejercicios{session.exercisesNote ? `: ${session.exercisesNote}` : ""}
        </Line>
        <Line done={session.churchDone} icon={<Church size={14} />}>
          Iglesia: {session.churchSong || <span className="text-neutral-400">sin nombre</span>}
        </Line>
        <Line done={session.newSongGoalMet} icon={<Music4 size={14} />}>
          Nueva{session.newSong ? ` (${session.newSong})` : ""}:{" "}
          {session.newSongGoal || <span className="text-neutral-400">sin meta</span>}
        </Line>
      </div>
    </div>
  );
}

function Line({ done, icon, children }: { done: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className={done ? "text-teal-600" : "text-neutral-300"}>
        {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </span>
      <span className="text-neutral-400">{icon}</span>
      <span className={`flex-1 ${done ? "text-neutral-700" : "text-neutral-500"}`}>{children}</span>
    </div>
  );
}

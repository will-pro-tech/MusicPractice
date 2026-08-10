import { useCallback, useEffect, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { Child, Session } from "../types";
import { api } from "../api";
import { todayISO, formatDate } from "../lib";
import { Button, EmptyState, Spinner } from "../ui";
import SessionCard from "../SessionCard";
import SessionForm from "../SessionForm";

export default function ChildToday({ child }: { child: Child }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [form, setForm] = useState<{ open: boolean; edit?: Session | null }>({ open: false });

  const load = useCallback(async () => {
    setSessions(await api.listSessions({ childId: child.id, date: todayISO() }));
  }, [child.id]);

  useEffect(() => {
    setSessions(null);
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-teal-500 to-teal-600 p-5 text-white">
        <p className="text-sm text-teal-100">{formatDate(todayISO())}</p>
        <h1 className="mt-0.5 text-2xl font-bold">Hola, {child.name} 👋</h1>
        <p className="mt-1 text-sm text-teal-50">
          Enfócate en tus metas de hoy — el tiempo es lo de menos.
        </p>
      </div>

      {sessions === null ? (
        <Spinner />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="Aún no has planeado la práctica de hoy"
          hint="Toca “Planear práctica” para escribir tus metas del día."
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onChanged={load} onEdit={(e) => setForm({ open: true, edit: e })} />
          ))}
        </div>
      )}

      <Button className="w-full" onClick={() => setForm({ open: true, edit: null })}>
        <Plus size={18} /> Planear práctica
      </Button>

      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-neutral-400">
        <Sparkles size={13} /> Cada práctica: ejercicios · canción de iglesia · canción nueva
      </p>

      {form.open && (
        <SessionForm
          child={child}
          initial={form.edit}
          onClose={() => setForm({ open: false })}
          onSaved={() => {
            setForm({ open: false });
            load();
          }}
        />
      )}
    </div>
  );
}

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
        <h1 className="mt-0.5 text-2xl font-bold">Hi, {child.name} 👋</h1>
        <p className="mt-1 text-sm text-teal-50">
          Focus on today's goals — the clock matters least.
        </p>
      </div>

      {sessions === null ? (
        <Spinner />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="You haven't planned today's practice yet"
          hint="Tap “Plan practice” to write your goals for the day."
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onChanged={load} onEdit={(e) => setForm({ open: true, edit: e })} />
          ))}
        </div>
      )}

      <Button className="w-full" onClick={() => setForm({ open: true, edit: null })}>
        <Plus size={18} /> Plan practice
      </Button>

      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-neutral-400">
        <Sparkles size={13} /> Each practice: exercises · church song · new song
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

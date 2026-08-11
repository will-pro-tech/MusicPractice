import { useState } from "react";
import {
  CalendarCheck, History, BarChart3, Users, Music2, ListMusic, CalendarDays,
  LogOut, ChevronDown, KeyRound, HelpCircle,
} from "lucide-react";
import { useUser } from "./auth";
import { api } from "./api";
import { cn, initials } from "./lib";
import { Button, Label, TextInput } from "./ui";
import ChildToday from "./pages/ChildToday";
import ChildHistory from "./pages/ChildHistory";
import ParentSummary from "./pages/ParentSummary";
import ParentChildren from "./pages/ParentChildren";
import ParentRepertoire from "./pages/ParentRepertoire";
import ParentServices from "./pages/ParentServices";

type Tab = "today" | "history" | "summary" | "repertoire" | "services" | "children";

const CHILD_TABS: { id: Tab; label: string; icon: typeof CalendarCheck }[] = [
  { id: "today", label: "Today", icon: CalendarCheck },
  { id: "history", label: "History", icon: History },
];
const PARENT_TABS: { id: Tab; label: string; icon: typeof CalendarCheck }[] = [
  { id: "summary", label: "Summary", icon: BarChart3 },
  { id: "repertoire", label: "Repertoire", icon: ListMusic },
  { id: "services", label: "Sundays", icon: CalendarDays },
  { id: "children", label: "Family", icon: Users },
];

export default function App() {
  const { user, logout } = useUser();
  const isParent = user.role === "parent";
  const [tab, setTab] = useState<Tab>(isParent ? "summary" : "today");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const tabs = isParent ? PARENT_TABS : CHILD_TABS;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-neutral-50/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm">
              <Music2 size={19} />
            </span>
            <div className="min-w-0 leading-none">
              <p className="truncate font-display text-lg font-extrabold text-teal-700">
                {user.familyName || "My Practice"}
              </p>
              <p className="text-[11px] font-medium text-neutral-400">Music practice</p>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2 text-sm font-semibold text-neutral-700 ring-1 ring-black/5"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                {initials(user.displayName)}
              </span>
              <ChevronDown size={14} className="text-neutral-400" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/5">
                  <div className="px-3 py-2">
                    <p className="font-semibold text-neutral-800">{user.displayName}</p>
                    <p className="text-xs text-neutral-500">@{user.username} · {isParent ? "Parent" : "Child"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setShowChangePw(true); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <KeyRound size={16} /> Change password
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setShowRecovery(true); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <HelpCircle size={16} /> Recovery question
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        {isParent ? (
          tab === "summary" ? <ParentSummary />
          : tab === "repertoire" ? <ParentRepertoire />
          : tab === "services" ? <ParentServices />
          : <ParentChildren />
        ) : tab === "today" ? (
          <ChildToday name={user.displayName} />
        ) : (
          <ChildHistory />
        )}
      </main>

      <nav className="pb-safe sticky bottom-0 z-30 border-t border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors",
                  active ? "text-teal-600" : "text-neutral-400",
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {showChangePw && <ChangePassword onClose={() => setShowChangePw(false)} />}
      {showRecovery && <RecoveryQuestion onClose={() => setShowRecovery(false)} />}
    </div>
  );
}

function RecoveryQuestion({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit() {
    if (!question.trim() || !answer.trim()) return setMsg("Enter a question and an answer.");
    setBusy(true);
    setMsg(null);
    try {
      await api.setRecoveryQuestion(question.trim(), answer);
      setOk(true);
      setMsg("Recovery question saved.");
      setTimeout(onClose, 900);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-neutral-50 p-5">
        <h2 className="text-lg font-bold text-neutral-800">Recovery question</h2>
        <p className="mt-1 text-sm text-neutral-500">Used to reset your password if you forget it.</p>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Question</Label>
            <TextInput value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Your first instrument?" />
          </div>
          <div>
            <Label>Answer</Label>
            <TextInput value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Something you'll remember" />
          </div>
          {msg && <p className={cn("text-sm font-medium", ok ? "text-teal-700" : "text-rose-600")}>{msg}</p>}
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChangePassword({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit() {
    if (next.length < 4) return setMsg("New password must be at least 4 characters.");
    setBusy(true);
    setMsg(null);
    try {
      await api.changePassword(current, next);
      setOk(true);
      setMsg("Password changed.");
      setTimeout(onClose, 900);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't change password");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-neutral-50 p-5">
        <h2 className="text-lg font-bold text-neutral-800">Change password</h2>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Current password</Label>
            <TextInput type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div>
            <Label>New password</Label>
            <TextInput
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="At least 4 characters"
            />
          </div>
          {msg && <p className={cn("text-sm font-medium", ok ? "text-teal-700" : "text-rose-600")}>{msg}</p>}
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

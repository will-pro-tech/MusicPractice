import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, History, BarChart3, Users, Music2, ListMusic, CalendarDays, Settings, Lock } from "lucide-react";
import type { AuthStatus, Child, Role } from "./types";
import { api } from "./api";
import { cn, colorOf, initials } from "./lib";
import { Spinner } from "./ui";
import ChildToday from "./pages/ChildToday";
import ChildHistory from "./pages/ChildHistory";
import ParentSummary from "./pages/ParentSummary";
import ParentChildren from "./pages/ParentChildren";
import ParentRepertoire from "./pages/ParentRepertoire";
import ParentServices from "./pages/ParentServices";
import { AccessSettings, ParentCodePrompt } from "./AccessSettings";

type Tab = "today" | "history" | "summary" | "repertoire" | "services" | "children";

const CHILD_TABS: { id: Tab; label: string; icon: typeof CalendarCheck }[] = [
  { id: "today", label: "Today", icon: CalendarCheck },
  { id: "history", label: "History", icon: History },
];
const PARENT_TABS: { id: Tab; label: string; icon: typeof CalendarCheck }[] = [
  { id: "summary", label: "Summary", icon: BarChart3 },
  { id: "repertoire", label: "Repertoire", icon: ListMusic },
  { id: "services", label: "Sundays", icon: CalendarDays },
  { id: "children", label: "Kids", icon: Users },
];

export default function App() {
  const [role, setRole] = useState<Role>(() => (localStorage.getItem("role") as Role) || "child");
  const [tab, setTab] = useState<Tab>(role === "child" ? "today" : "summary");
  const [children, setChildren] = useState<Child[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem("selectedChildId"));
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const loadChildren = useCallback(async () => {
    const list = await api.listChildren();
    setChildren(list);
    setSelectedId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    loadChildren();
    api.authStatus().then(setAuthStatus);
  }, [loadChildren]);

  // Keep the child list fresh when entering the child side (parents may have
  // just added someone on the other tab).
  useEffect(() => {
    if (role === "child") loadChildren();
  }, [role, loadChildren]);

  function switchRole(next: Role) {
    setRole(next);
    localStorage.setItem("role", next);
    setTab(next === "child" ? "today" : "summary");
  }

  function selectChild(id: string) {
    setSelectedId(id);
    localStorage.setItem("selectedChildId", id);
  }

  if (!authStatus) {
    return (
      <div className="grid min-h-full place-items-center bg-neutral-50">
        <Spinner />
      </div>
    );
  }

  // The Parents side is gated by the parent code (if one is set) until unlocked.
  const lockedParent = role === "parent" && authStatus.parentCodeSet && !parentUnlocked;
  const tabs = role === "child" ? CHILD_TABS : PARENT_TABS;
  const selectedChild = children?.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-neutral-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-neutral-50/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-bold text-teal-700">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-600 text-white">
              <Music2 size={18} />
            </span>
            My Practice
          </div>
          <div className="flex items-center gap-2">
            {role === "parent" && !lockedParent && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                aria-label="Access codes"
                className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-200"
              >
                <Settings size={20} />
              </button>
            )}
            <RoleToggle role={role} onChange={switchRole} />
          </div>
        </div>

        {role === "child" && children && children.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3">
            {children.map((c) => {
              const color = colorOf(c.color);
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectChild(c.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-semibold transition",
                    active ? "bg-teal-600 text-white" : "bg-white text-neutral-600 ring-1 ring-black/5",
                  )}
                >
                  <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs font-bold", active ? "bg-white/20 text-white" : `${color.bg} ${color.text}`)}>
                    {initials(c.name)}
                  </span>
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4">
        {lockedParent ? (
          <ParentLocked />
        ) : children === null ? (
          <Spinner />
        ) : role === "child" ? (
          !selectedChild ? (
            <NoChildren />
          ) : tab === "today" ? (
            <ChildToday key={selectedChild.id} child={selectedChild} />
          ) : (
            <ChildHistory key={selectedChild.id} child={selectedChild} />
          )
        ) : tab === "summary" ? (
          <ParentSummary />
        ) : tab === "repertoire" ? (
          <ParentRepertoire />
        ) : tab === "services" ? (
          <ParentServices />
        ) : (
          <ParentChildren />
        )}
      </main>

      {/* Bottom nav (hidden while the Parents side is locked) */}
      {!lockedParent && (
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
      )}

      {lockedParent && (
        <ParentCodePrompt
          onSuccess={() => setParentUnlocked(true)}
          onCancel={() => switchRole("child")}
        />
      )}

      {showSettings && (
        <AccessSettings
          status={authStatus}
          onClose={() => setShowSettings(false)}
          onChanged={(s) => {
            setAuthStatus(s);
            setParentUnlocked(true); // don't lock yourself out right after setting it
          }}
        />
      )}
    </div>
  );
}

function RoleToggle({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div className="flex rounded-full bg-neutral-200 p-0.5 text-sm font-semibold">
      {(["child", "parent"] as Role[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            "rounded-full px-3 py-1 transition-colors",
            role === r ? "bg-white text-teal-700 shadow-sm" : "text-neutral-500",
          )}
        >
          {r === "child" ? "Kid" : "Parents"}
        </button>
      ))}
    </div>
  );
}

function ParentLocked() {
  return (
    <div className="grid place-items-center py-16 text-center text-neutral-400">
      <Lock size={28} />
      <p className="mt-2 text-sm">Parents is locked.</p>
    </div>
  );
}

function NoChildren() {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-4 py-12 text-center">
      <p className="font-semibold text-neutral-700">No kids set up yet</p>
      <p className="mt-1 text-sm text-neutral-500">
        Switch to <span className="font-medium">Parents</span> above and add each child with their instrument.
      </p>
    </div>
  );
}

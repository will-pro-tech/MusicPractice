import { useState } from "react";
import {
  CalendarCheck, History, BarChart3, Users, Music2, ListMusic, CalendarDays,
  LogOut, ChevronDown,
} from "lucide-react";
import { useUser } from "./auth";
import { cn, colorOf, initials } from "./lib";
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
  { id: "children", label: "Kids", icon: Users },
];

export default function App() {
  const { user, logout } = useUser();
  const isParent = user.role === "parent";
  const [tab, setTab] = useState<Tab>(isParent ? "summary" : "today");
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = isParent ? PARENT_TABS : CHILD_TABS;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-neutral-50/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-bold text-teal-700">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-600 text-white">
              <Music2 size={18} />
            </span>
            My Practice
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
    </div>
  );
}

import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "./lib";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5", className)}>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/50 px-4 py-10 text-center">
      <p className="font-medium text-neutral-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-neutral-500">{hint}</p>}
    </div>
  );
}

/** A big tappable checkbox row — the core "hecho" control for a practice part. */
export function CheckRow({
  checked,
  onToggle,
  icon,
  title,
  children,
  accent = "text-teal-600",
}: {
  checked: boolean;
  onToggle: () => void;
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  accent?: string;
}) {
  return (
    <div className={cn("rounded-2xl p-3 ring-1 transition-colors", checked ? "bg-teal-50 ring-teal-200" : "bg-white ring-black/5")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className={cn("shrink-0", accent)}>{icon}</span>
        <span className="flex-1 font-semibold text-neutral-800">{title}</span>
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
            checked ? "border-teal-500 bg-teal-500 text-white" : "border-neutral-300 bg-white",
          )}
        >
          {checked && <Check size={16} strokeWidth={3} />}
        </span>
      </button>
      {children && <div className="mt-2 pl-9 text-sm text-neutral-600">{children}</div>}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-neutral-700">{children}</label>;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200",
        props.className,
      )}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200",
        props.className,
      )}
    />
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-300",
    ghost: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
    danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

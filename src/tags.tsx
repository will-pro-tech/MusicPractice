import { useState, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "./lib";

/** Editable list of tags shown as removable chips. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}) {
  const [text, setText] = useState("");

  function add(raw: string) {
    const t = raw.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setText("");
  }
  function remove(t: string) {
    onChange(value.filter((x) => x !== t));
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && value.length) {
      remove(value[value.length - 1]);
    }
  }

  const available = suggestions.filter((s) => !value.includes(s));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-300 bg-white p-2 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-200">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-sm font-medium text-teal-800">
            {t}
            <button type="button" onClick={() => remove(t)} className="text-teal-600 hover:text-teal-900">
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => add(text)}
          placeholder={value.length ? "" : "Agrega un tema y Enter…"}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
      {available.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {available.slice(0, 12).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-200"
            >
              <Plus size={11} /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Row of selectable tag chips used to filter a list. `null` = "all". */
export function TagFilter({
  tags,
  active,
  onSelect,
}: {
  tags: string[];
  active: string | null;
  onSelect: (tag: string | null) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip label="Todas" selected={active === null} onClick={() => onSelect(null)} />
      {tags.map((t) => (
        <Chip key={t} label={t} selected={active === t} onClick={() => onSelect(active === t ? null : t)} />
      ))}
    </div>
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-sm font-medium transition-colors",
        selected ? "bg-teal-600 text-white" : "bg-white text-neutral-600 ring-1 ring-black/10 hover:bg-neutral-100",
      )}
    >
      {label}
    </button>
  );
}

export function TagChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
          #{t}
        </span>
      ))}
    </div>
  );
}

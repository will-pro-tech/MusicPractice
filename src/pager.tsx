import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Client-side pagination in fixed-size blocks. `resetKey` sends the view back
 * to the first block whenever it changes (e.g. a search or filter changed).
 */
export function usePager<T>(items: T[] | null, size = 25, resetKey?: unknown) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  const total = items?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pageCount - 1);
  const pageItems = items ? items.slice(current * size, current * size + size) : [];

  return { page: current, setPage, total, pageCount, size, pageItems };
}

export function Pager({
  page,
  pageCount,
  total,
  size,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  size: number;
  onPage: (p: number) => void;
}) {
  if (total <= size) return null;
  const go = (p: number) => {
    onPage(p);
    window.scrollTo({ top: 0 });
  };
  const from = page * size + 1;
  const to = Math.min((page + 1) * size, total);
  const btn =
    "inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 ring-1 ring-black/10 disabled:opacity-40";

  return (
    <div className="flex items-center justify-between px-1 pt-1">
      <button type="button" onClick={() => go(page - 1)} disabled={page === 0} className={btn}>
        <ChevronLeft size={16} /> Prev
      </button>
      <span className="text-xs text-neutral-500">
        {from}–{to} of {total}
      </span>
      <button type="button" onClick={() => go(page + 1)} disabled={page >= pageCount - 1} className={btn}>
        Next <ChevronRight size={16} />
      </button>
    </div>
  );
}

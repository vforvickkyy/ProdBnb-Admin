interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /**
   * A short section name (e.g. "Locations", "Bookings hosted") -- several
   * detail pages (Phase 14-B1/B2) render more than one Pagination on the
   * same page, and without this every "Previous"/"Next" button announces
   * identically to a screen reader with no way to tell them apart. Omit it
   * for a page with exactly one Pagination, where that ambiguity can't
   * arise -- existing behavior is unchanged either way.
   */
  label?: string;
}

const PAGE_SIZE_MAX = 100; // matches the backend's own zod ceiling on every list endpoint

export function Pagination({ page, pageSize, total, onPageChange, label }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const content = (
    <div className="flex items-center justify-between gap-3 px-1 py-3 text-[13px] text-slate-500">
      <span>
        {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 font-medium text-slate-700 shadow-card transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 font-medium text-slate-700 shadow-card transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );

  return label ? <nav aria-label={`${label} pagination`}>{content}</nav> : content;
}

export { PAGE_SIZE_MAX };

import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-slate-200/80", !/\brounded/.test(className ?? "") && "rounded-md", className)} aria-hidden="true" />;
}

// Matches the real table's column count so the loading state doesn't jump
// around once data arrives -- pre-Phase-14 loading states were a single
// "Loading…" string with no shape at all.
export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" role="status" aria-label="Loading">
      <div className="flex h-10 items-center gap-4 border-b border-slate-200 px-4">
        {Array.from({ length: columns }).map((_, j) => (
          <Skeleton key={j} className="h-3 flex-1 opacity-60" />
        ))}
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

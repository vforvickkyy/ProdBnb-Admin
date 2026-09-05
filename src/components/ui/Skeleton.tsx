import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-slate-200", className)} aria-hidden="true" />;
}

// Matches the real table's column count so the loading state doesn't jump
// around once data arrives -- pre-Phase-14 loading states were a single
// "Loading…" string with no shape at all.
export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white" role="status" aria-label="Loading">
      <div className="border-b border-slate-200 bg-slate-100 px-4 py-2">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

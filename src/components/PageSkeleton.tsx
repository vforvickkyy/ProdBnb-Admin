import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The shape of a typical console page -- title, a row of figures, a list -- shown the instant a
 * navigation starts, so a click always visibly lands even before the new page's code and data
 * arrive. Each page then swaps in its own, more specific loading state.
 */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="animate-fade-in">
      <div className="mb-8 space-y-2.5">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 bg-white p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex gap-6 border-b border-slate-200 px-5 py-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-20" />
          ))}
        </div>
        <div className="divide-y divide-slate-200">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-5 py-3.5">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-32 sm:block" />
              <Skeleton className="hidden h-4 w-24 md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

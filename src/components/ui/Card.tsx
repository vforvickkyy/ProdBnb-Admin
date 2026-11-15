import { cn } from "@/lib/cn";

/** The one surface every section of every page sits on. */
export function Card({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A label/value list -- the detail pages' standard layout. */
export function KeyValues({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex justify-between gap-4 py-1.5">
          <dt className="shrink-0 text-slate-500">{item.label}</dt>
          <dd className="min-w-0 break-words text-right text-slate-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

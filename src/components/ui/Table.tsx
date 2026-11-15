import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  caption: string;
}

// Wrapped in overflow-x-auto unconditionally -- the pre-Phase-14 tables had
// no such wrapper and broke the page layout on anything narrower than
// ~900px. `scope="col"` and a (visually hidden) caption are here for screen
// readers; nothing about the visual design changes.
export function Table<T>({ columns, rows, rowKey, onRowClick, caption }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className={cn("h-10 px-4 font-medium", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-700">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((col) => (
                <td key={col.key} className={cn("px-4 py-3", col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

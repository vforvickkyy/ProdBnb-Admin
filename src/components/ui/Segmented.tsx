import { cn } from "@/lib/cn";

/** A small single-choice control (tabs for a filter or a view), keyboard-reachable as radio buttons. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-md border border-slate-300 bg-white p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded px-2.5 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

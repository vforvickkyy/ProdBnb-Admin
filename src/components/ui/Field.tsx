import { useId } from "react";
import { cn } from "@/lib/cn";

const INPUT =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50";

export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input id={id} aria-describedby={hint || error ? `${id}-hint` : undefined} aria-invalid={Boolean(error)} className={INPUT} {...props} />
      {(error || hint) && (
        <p id={`${id}-hint`} className={cn("mt-1 text-xs", error ? "text-red-700" : "text-slate-500")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={INPUT} {...props} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select id={id} className={INPUT} {...props}>
        {children}
      </select>
    </div>
  );
}

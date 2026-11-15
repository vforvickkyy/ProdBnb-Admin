import { useId } from "react";
import { cn } from "@/lib/cn";

export const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-card transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-red-400";
const INPUT = INPUT_CLASS;
const LABEL = "mb-1.5 block text-[13px] font-medium text-slate-700";

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
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input id={id} aria-describedby={hint || error ? `${id}-hint` : undefined} aria-invalid={Boolean(error)} className={INPUT} {...props} />
      {(error || hint) && (
        <p id={`${id}-hint`} className={cn("mt-1.5 text-xs leading-5", error ? "text-red-700" : "text-slate-500")}>
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
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <textarea id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={INPUT} {...props} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-slate-500">
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
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select id={id} className={INPUT} {...props}>
        {children}
      </select>
    </div>
  );
}

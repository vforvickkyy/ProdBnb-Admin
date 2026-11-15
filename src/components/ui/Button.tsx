import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "brand";

// Console 3: one blue primary (accent fills keep white text at AA in both themes), quiet bordered
// secondary, red-text danger, borderless ghost. `brand` is kept as an alias of primary for callers.
const PRIMARY = "bg-accent-500 text-snow shadow-sm hover:bg-accent-600 focus-visible:ring-accent-400";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: PRIMARY,
  brand: PRIMARY,
  secondary: "border border-slate-200 bg-white text-slate-800 shadow-card hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-accent-400",
  danger: "border border-red-200 bg-white text-red-700 shadow-card hover:border-red-300 hover:bg-red-50 focus-visible:ring-red-400",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-accent-400",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }
>(function Button({ variant = "secondary", size = "md", className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-[color,background-color,border-color,box-shadow] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
});

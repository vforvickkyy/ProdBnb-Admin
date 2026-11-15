"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ThemeChoice } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
  { value: "system", label: "Match system theme", Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { choice, setChoice } = useTheme();
  return (
    <div role="group" aria-label="Theme" className={cn("inline-flex rounded-lg bg-slate-100 p-0.5", className)}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={choice === value}
          title={label}
          onClick={() => setChoice(value)}
          className={cn(
            "rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
            choice === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          <Icon aria-hidden className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

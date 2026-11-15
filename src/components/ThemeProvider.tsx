"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { applyTheme, readStoredTheme, resolveTheme, ResolvedTheme, storeTheme, ThemeChoice } from "@/lib/theme";

interface ThemeContextValue {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ choice: "system", resolved: "light", setChoice: () => undefined });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = readStoredTheme();
    setChoiceState(stored);
    setResolved(resolveTheme(stored));
  }, []);

  // Follow the OS while on "system".
  useEffect(() => {
    if (choice !== "system" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = media.matches ? "dark" : "light";
      setResolved(next);
      applyTheme(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    storeTheme(next);
    setChoiceState(next);
    const value = resolveTheme(next);
    setResolved(value);
    applyTheme(value);
  }, []);

  return <ThemeContext.Provider value={{ choice, resolved, setChoice }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

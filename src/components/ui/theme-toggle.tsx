"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
        className,
      )}
    >
      <Sun
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          isDark ? "-translate-y-6 opacity-0" : "translate-y-0 opacity-100",
        )}
        aria-hidden
      />
      <Moon
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          isDark ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        )}
        aria-hidden
      />
    </button>
  );
}

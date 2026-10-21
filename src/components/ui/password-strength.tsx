"use client";

/**
 * Password Strength Indicator
 *
 * HOW THIS WORKS (for learning):
 *
 * This is a visual component that shows how strong a password is.
 * It renders a colored bar that fills up (from red → yellow → green)
 * as the password gets stronger.
 *
 * It uses the `getPasswordStrength()` function from our validation module
 * to calculate the score, then renders a bar + label.
 *
 * WHAT IS `useMemo`?
 * React re-renders components when state changes. `useMemo` tells React:
 * "Only recalculate this value if `password` changes — don't recalculate
 * on EVERY render." It's a performance optimization.
 */

import { useMemo } from "react";
import { getPasswordStrength } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";

export function PasswordStrengthBar({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  // Only recalculate strength when the password actually changes
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  // Don't show anything if the user hasn't typed a password yet
  if (!password) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* The bar track (background) */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
        {/* The bar fill (colored portion) — width is controlled by the strength score */}
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${strength.percentage}%`,
            backgroundColor: strength.color,
          }}
        />
      </div>
      {/* Label: "Weak", "Fair", "Good", "Strong" */}
      <p
        className="text-xs font-medium"
        style={{ color: strength.color }}
      >
        {strength.label}
      </p>
    </div>
  );
}

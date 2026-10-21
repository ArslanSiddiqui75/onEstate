"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  "linear-gradient(135deg,#0c6e63,#1fb3a3)",
  "linear-gradient(135deg,#38648c,#5f8fc4)",
  "linear-gradient(135deg,#b45309,#e08a3c)",
  "linear-gradient(135deg,#7c3aed,#a78bfa)",
  "linear-gradient(135deg,#c2410c,#f2794f)",
  "linear-gradient(135deg,#0f7a4f,#3fbd82)",
];

function gradientFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % GRADIENTS.length;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs";
  return (
    <AvatarPrimitive.Root
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white shadow-[0_2px_6px_rgba(0,0,0,0.18)]",
        dims,
        className,
      )}
      style={{ background: gradientFor(name || "?") }}
    >
      <AvatarPrimitive.Fallback delayMs={0}>
        {initials(name || "?")}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function AvatarStack({
  names,
  max = 4,
}: {
  names: string[];
  max?: number;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((name, i) => (
        <Avatar
          key={`${name}_${i}`}
          name={name}
          size="sm"
          className="ring-2 ring-[var(--surface-elevated)]"
        />
      ))}
      {rest > 0 ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[10px] font-semibold text-[var(--muted)] ring-2 ring-[var(--surface-elevated)]">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Skeleton Loading Components
 *
 * HOW THIS WORKS (for learning):
 *
 * When data is loading (e.g., fetching leads from the database), instead of
 * showing a blank page or a spinner, we show "skeleton" shapes that look like
 * the content that's about to appear. This is called a "skeleton screen" or
 * "content placeholder".
 *
 * You've seen this on YouTube (grey rectangles where videos will appear),
 * LinkedIn (grey lines where posts will appear), etc.
 *
 * WHY is this better than a spinner?
 * - It gives users a sense of the page layout BEFORE data loads
 * - It feels faster (even if it takes the same time)
 * - It reduces "layout shift" (content jumping around when it loads)
 *
 * HOW TO USE:
 *   <Skeleton className="h-4 w-32" />           → a single grey bar
 *   <SkeletonCard />                             → a full card placeholder
 *   <SkeletonTable rows={5} columns={4} />       → a table placeholder
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Base Skeleton ───────────────────────────────────────────────────────────
// A single animated grey rectangle. You control the size via className.
// The `skeleton` CSS class (defined in globals.css) adds the shimmer animation.

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton h-4 w-full", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

// ─── Skeleton Card ───────────────────────────────────────────────────────────
// A card-shaped placeholder (like a stat card or a lead card).

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "data-card space-y-3 p-5",
        className,
      )}
      aria-hidden="true"
    >
      {/* Title line */}
      <Skeleton className="h-4 w-2/5" />
      {/* Body lines */}
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
      {/* Bottom action area */}
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// ─── Skeleton Table ──────────────────────────────────────────────────────────
// A table-shaped placeholder with configurable rows and columns.

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {/* Table header */}
      <div className="flex gap-4 border-b border-[var(--border)] pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-3 flex-1" />
        ))}
      </div>
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`row-${rowIdx}`}
          className="flex items-center gap-4 py-2.5"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={`cell-${rowIdx}-${colIdx}`}
              className={cn(
                "h-3 flex-1",
                // Vary widths to look more natural
                colIdx === 0 && "max-w-[120px]",
                colIdx === columns - 1 && "max-w-[80px]",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton Stat Card ──────────────────────────────────────────────────────
// Matches the shape of the StatCard component used on the dashboard.

export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("data-card space-y-3 p-5", className)}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-10 rounded-[var(--radius-sm)]" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

// ─── Skeleton Page ───────────────────────────────────────────────────────────
// A full page skeleton (header + stat cards + table). Use this when an entire
// module page is loading.

export function SkeletonPage({
  title = true,
  stats = 4,
  tableRows = 6,
}: {
  title?: boolean;
  stats?: number;
  tableRows?: number;
}) {
  return (
    <div className="space-y-6" aria-label="Loading..." role="status">
      {/* Page header */}
      {title && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      )}
      {/* Stat cards row */}
      {stats > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <SkeletonStatCard key={`stat-${i}`} />
          ))}
        </div>
      )}
      {/* Content table */}
      <div className="data-card p-5">
        <SkeletonTable rows={tableRows} />
      </div>
    </div>
  );
}

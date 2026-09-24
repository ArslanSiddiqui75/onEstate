export type SnapshotRange = "7d" | "30d" | "90d" | "all";

export const SNAPSHOT_RANGES: { id: SnapshotRange; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "all", label: "All" },
];

export function snapshotCutoff(
  range: SnapshotRange,
  now = Date.now(),
): number | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return now - days * 86_400_000;
}

export function withinSnapshot(
  iso: string | undefined,
  cutoff: number | null,
): boolean {
  if (cutoff === null) return true;
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= cutoff;
}

export function countBy(
  items: Array<Record<string, unknown>>,
  key: string,
): [string, number][] {
  const map = new Map<string, number>();
  for (const item of items) {
    const value = String(item[key] || "—");
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function rowsToCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(","),
    )
    .join("\n");
}

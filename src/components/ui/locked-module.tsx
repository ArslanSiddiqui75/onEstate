import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LockedModule({
  title,
  reason,
  href = "/app/billing",
  className,
}: {
  title: string;
  reason: string;
  href?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[1.75rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(12,110,99,0.06),transparent)] px-6 py-24 text-center",
        className,
      )}
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
        <Lock className="h-5 w-5" aria-hidden />
      </div>
      <h2 className="font-display text-3xl tracking-tight text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{reason}</p>
      <Button asChild className="mt-7 rounded-full">
        <Link href={href}>View plans</Link>
      </Button>
    </div>
  );
}

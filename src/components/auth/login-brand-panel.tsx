import { HouseMark } from "@/components/brand/house-mark";
import { cn } from "@/lib/utils";

/**
 * Lock-screen brand column.
 * One layout box for both themes — only paints (wash vs ink) change.
 * Height follows the login card so the page can stay within 100dvh.
 */
export function LoginBrandPanel({
  headline,
  support,
  markClassName,
  className,
}: {
  headline: string;
  support: string;
  /** Width classes for the house mark box (shared across themes). */
  markClassName?: string;
  className?: string;
}) {
  const markSize =
    markClassName ??
    "w-[min(8.5rem,42%)] sm:w-[min(10.5rem,48%)] lg:w-[min(13.5rem,64%)]";

  return (
    <aside
      className={cn(
        "relative flex min-h-0 flex-col justify-between overflow-hidden border-b p-5 sm:p-6 lg:h-full lg:border-b-0 lg:border-r lg:p-8 xl:p-10",
        "border-[var(--border)] bg-[linear-gradient(165deg,#f3f8f7_0%,#e7f1ef_48%,#dfecea_100%)] text-[var(--foreground)]",
        /* bg-none clears the light gradient image; solid ink color alone cannot. */
        "dark:border-white/10 dark:bg-none dark:bg-[#071015] dark:text-white",
        className,
      )}
    >
      {/* Light wash (paint only) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(12,110,99,0.14),transparent_58%)] dark:hidden"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[#0c6e63]/10 blur-3xl dark:hidden"
      />

      {/* Dark ink (paint only) — same geometry as light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-[image:var(--ink-mesh)] dark:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_50%_42%,rgba(23,186,168,0.22),transparent_58%)] dark:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-0 hidden h-64 w-64 rounded-full bg-[#17baa8]/15 blur-3xl dark:block"
      />

      <div className="relative flex min-h-0 flex-1 items-center justify-center py-3 sm:py-4 lg:py-6">
        <HouseMark className={cn("login-panel-mark max-h-full", markSize)} />
      </div>
      <div className="relative max-w-sm shrink-0">
        <h2 className="font-sans text-[1.85rem] font-semibold leading-[0.92] tracking-[-0.045em] sm:text-[2.25rem] lg:text-[2.75rem]">
          {headline}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)] sm:mt-3 sm:text-[14px] lg:mt-3.5 dark:text-white/70">
          {support}
        </p>
      </div>
    </aside>
  );
}

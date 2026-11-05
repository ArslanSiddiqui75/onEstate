import { cn } from "@/lib/utils";

/**
 * Left lock-screen panel. Dark theme keeps the original ink treatment and
 * bright house mark. Light theme uses a soft teal wash and the dark mark.
 */
export function LoginBrandPanel({
  headline,
  support,
  markClassName,
  className,
}: {
  headline: string;
  support: string;
  markClassName?: string;
  className?: string;
}) {
  const markSize =
    markClassName ??
    "h-auto w-[min(11rem,46%)] object-contain sm:w-[min(14rem,56%)] lg:w-[min(17.5rem,72%)]";

  return (
    <aside
      className={cn(
        // Light theme
        "relative flex min-h-[18.5rem] flex-col justify-between overflow-hidden border-b border-[var(--border)] bg-[linear-gradient(165deg,#f3f8f7_0%,#e7f1ef_48%,#dfecea_100%)] p-6 text-[var(--foreground)] sm:min-h-[22rem] sm:p-8 lg:min-h-[40rem] lg:border-b-0 lg:border-r lg:p-10 xl:p-12",
        // Dark theme — original ink panel
        "dark:border-white/10 dark:bg-[#071015] dark:text-white dark:lg:border-white/10",
        className,
      )}
    >
      {/* Dark-only mesh (same as before) */}
      <div className="pointer-events-none absolute inset-0 hidden bg-[image:var(--ink-mesh)] dark:block" />
      {/* Light glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(12,110,99,0.14),transparent_58%)] dark:hidden" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[#0c6e63]/10 blur-3xl dark:hidden" />
      {/* Dark glow — original */}
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_50%_38%,rgba(23,186,168,0.22),transparent_58%)] dark:block" />
      <div className="pointer-events-none absolute -left-16 bottom-0 hidden h-64 w-64 rounded-full bg-[#17baa8]/15 blur-3xl dark:block" />

      <div className="relative flex flex-1 items-center justify-center py-6 sm:py-8 lg:py-10">
        <img
          src="/brand/loader-mark-light.webp"
          alt=""
          width={475}
          height={516}
          draggable={false}
          className={cn("login-panel-mark dark:hidden", markSize)}
        />
        <img
          src="/brand/loader-mark-dark.webp"
          alt=""
          width={475}
          height={516}
          draggable={false}
          className={cn("login-panel-mark hidden dark:block", markSize)}
        />
      </div>

      <div className="relative max-w-sm">
        <h2 className="font-sans text-[2.15rem] font-semibold leading-[0.92] tracking-[-0.045em] sm:text-[2.6rem] lg:text-[3.25rem]">
          {headline}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)] sm:mt-4 sm:text-[15px] lg:mt-5 dark:text-white/70">
          {support}
        </p>
      </div>
    </aside>
  );
}

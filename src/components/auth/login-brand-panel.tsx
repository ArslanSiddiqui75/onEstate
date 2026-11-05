import { cn } from "@/lib/utils";

/**
 * Left lock-screen panel. Follows the active theme — light surface + dark
 * mark in light mode, ink panel + bright mark in dark mode.
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
  return (
    <aside
      className={cn(
        "relative flex min-h-[18.5rem] flex-col justify-between overflow-hidden border-b border-[var(--border)] bg-[linear-gradient(165deg,#f3f8f7_0%,#e7f1ef_48%,#dfecea_100%)] p-6 text-[var(--foreground)] sm:min-h-[22rem] sm:p-8 lg:min-h-[40rem] lg:border-b-0 lg:border-r lg:p-10 xl:p-12",
        "dark:border-white/10 dark:bg-[#071015] dark:text-white",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 hidden bg-[image:var(--ink-mesh)] dark:block" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(12,110,99,0.14),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_50%_38%,rgba(23,186,168,0.22),transparent_58%)]" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[#0c6e63]/10 blur-3xl dark:bg-[#17baa8]/15" />

      <div className="relative flex flex-1 items-center justify-center py-6 sm:py-8 lg:py-10">
        <div className={cn("relative", markClassName ?? "h-auto w-[min(11rem,46%)] sm:w-[min(14rem,56%)] lg:w-[min(17.5rem,72%)]")}>
          <img
            src="/brand/loader-mark-light.webp"
            alt=""
            width={475}
            height={516}
            draggable={false}
            className="login-panel-mark h-auto w-full object-contain dark:hidden"
          />
          <img
            src="/brand/loader-mark-dark.webp"
            alt=""
            width={475}
            height={516}
            draggable={false}
            className="login-panel-mark hidden h-auto w-full origin-center scale-[1.08] object-contain dark:block"
          />
        </div>
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

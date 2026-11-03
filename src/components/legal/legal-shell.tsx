import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/brand-mark";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="shrink-0">
            <BrandMark className="text-[15px]" />
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
            <Link href="/legal/terms" className="hover:text-[var(--foreground)]">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-[var(--foreground)]">
              Privacy
            </Link>
            <Link href="/app/signup" className="font-semibold text-[var(--accent)]">
              Sign up
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Legal
        </p>
        <h1 className="mt-2 font-sans text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Last updated {updated}</p>
        <div className="legal-prose mt-10 space-y-10 text-[15px] leading-relaxed text-[var(--foreground)]">
          {children}
        </div>
      </main>
      <footer className="border-t border-[var(--border)] py-8 text-center text-xs text-[var(--muted)]">
        <p>
          Questions?{" "}
          <Link href="/#contact" className="text-[var(--accent)] hover:underline">
            Contact us
          </Link>
        </p>
      </footer>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="mt-3 space-y-3 text-[var(--foreground)]/90">{children}</div>
    </section>
  );
}

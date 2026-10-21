import Link from "next/link";

export default function PublicSiteNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-20 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="font-display text-3xl tracking-tight">Site not available</h1>
        <p className="text-sm text-[var(--muted)]">
          This address doesn’t point to a published website. If you own this site,
          publish it from your workspace to make it live.
        </p>
        <Link href="/" className="inline-block text-sm underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}

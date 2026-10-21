/**
 * 404 Not Found Page
 *
 * HOW THIS WORKS (for learning):
 *
 * When someone goes to a URL that doesn't exist (like /app/blahblah),
 * Next.js looks for a "not-found.tsx" file and renders it.
 *
 * Without this file, Next.js shows a very basic default 404 page.
 * With it, we can show a branded, friendly error page that matches
 * our app's design and helps users get back to where they need to be.
 */

import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <BrandMark className="scale-125" />
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--foreground)]">
          Page not found
        </h1>
        <p className="max-w-md text-[var(--muted)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/app">Go to workspace</Link>
        </Button>
      </div>
    </div>
  );
}

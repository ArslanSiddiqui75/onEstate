import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HouseMark } from "@/components/brand/house-mark";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <HouseMark className="h-[7.5rem] w-[6.35rem]" />
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

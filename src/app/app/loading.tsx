/**
 * App Loading State
 *
 * HOW THIS WORKS (for learning):
 *
 * In Next.js App Router, if you create a file called "loading.tsx" in any
 * route folder, Next.js will AUTOMATICALLY show this component while the
 * page is loading (e.g., during navigation or data fetching).
 *
 * Think of it like a "please wait" screen that appears automatically — you
 * don't need to write any "if (loading) return <Spinner />" code yourself.
 *
 * This file uses our SkeletonPage component to show a nice shimmer effect
 * that matches the shape of the actual page content.
 */

import { SkeletonPage } from "@/components/ui/skeleton";

export default function AppLoading() {
  return <SkeletonPage />;
}

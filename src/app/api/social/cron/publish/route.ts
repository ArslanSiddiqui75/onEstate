import { after, NextResponse } from "next/server";
import { publishDuePosts } from "@/lib/social/publish-service";
import { unauthorizedCronResponse } from "@/lib/server/cron-auth";

// Publishing polls each platform's processing status before publishing (see
// waitForContainerReady in providers.ts), which can take tens of seconds per
// post. Give the function room instead of letting the platform kill it mid-
// batch. Raise this further on plans that allow longer function durations.
export const maxDuration = 60;

/** One due post per cron tick — external schedulers (cron-job.org) often time out ~30s. */
const DEFAULT_CRON_BATCH = 1;

function cronBatchLimit(): number {
  const raw = process.env.SOCIAL_CRON_BATCH_SIZE;
  if (!raw) return DEFAULT_CRON_BATCH;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CRON_BATCH;
  return Math.min(n, 5);
}

// Point Vercel Cron (vercel.json) or an external scheduler at this route every
// few minutes so "Schedule" posts actually go out. There is no in-process
// timer — without a hit to this route, due posts stay `scheduled` forever.
async function handle(request: Request) {
  const denied = unauthorizedCronResponse(request, [
    process.env.SOCIAL_CRON_SECRET,
  ]);
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = cronBatchLimit();
  const sync = url.searchParams.get("sync") === "1";

  // Manual/debug: ?sync=1 waits for the batch result (may exceed cron-job.org timeout).
  if (sync) {
    const summary = await publishDuePosts(limit);
    return NextResponse.json(summary);
  }

  // Respond immediately so cron-job.org (~30s client timeout) does not mark the job failed
  // while Instagram/media polling continues in the background.
  after(async () => {
    try {
      await publishDuePosts(limit);
    } catch (err) {
      console.error("[social/cron/publish] background publish failed:", err);
    }
  });

  return NextResponse.json({
    accepted: true,
    batchLimit: limit,
    message: "Processing due posts in background. Use ?sync=1 to await results.",
  });
}

export const GET = handle;
export const POST = handle;

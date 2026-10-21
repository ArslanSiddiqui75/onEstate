import type { Metadata } from "next";
import { ReportDesk } from "@/components/lettings/report-desk";
import { seedPropertyByToken } from "@/lib/lettings/book";
import { findServerRepair } from "@/lib/lettings/server-inbox";
import type { RepairChannel } from "@/lib/lettings/types";

function channelFrom(via: string | undefined): RepairChannel {
  if (via === "qr" || via === "text" || via === "whatsapp") return via;
  return "link";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const property = seedPropertyByToken(token);
  const address = property ? `${property.address} — ` : "";
  return {
    title: `${address}Report a repair`,
    description: "Tell the office about a repair. No account needed.",
  };
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ via?: string; sent?: string; error?: string; noted?: string }>;
}) {
  const { token } = await params;
  const { via, sent, error, noted } = await searchParams;
  const property = seedPropertyByToken(token);
  const sentRepair = sent ? findServerRepair(sent) : null;
  const banner =
    error === "short"
      ? "Describe the problem in a sentence, then send it again."
      : error === "unknown"
        ? "This repair link isn’t recognised."
        : error
          ? "We couldn’t save that report. Try again in a moment."
          : noted === "confirmed"
            ? "Confirmation received. The office will match it to the repair once it is marked fixed."
            : noted === "signed"
              ? "Inspection signed. The office has your name on the report."
              : null;

  return (
    <>
      <noscript>
        <p className="bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium">
          If you smell gas, leave the building and call 0800 111 999. Don’t wait for this page.
        </p>
      </noscript>
      {banner ? (
        <p className="bg-[var(--surface)] px-4 py-3 text-center text-sm font-medium" role="status">
          {banner}
        </p>
      ) : null}
      <ReportDesk token={token} via={channelFrom(via)} seedProperty={property} initialRepair={sentRepair} />
    </>
  );
}

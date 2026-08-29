"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MessageSequence, SequenceEnrollment } from "@/types";

export function SequenceCatalog({ sequences }: { sequences: MessageSequence[] }) {
  if (!sequences.length) {
    return (
      <p className="mt-3 text-sm text-[var(--muted)]">
        Sequences will appear here after the workspace loads.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {sequences.map((seq) => (
        <div
          key={seq.id}
          className="rounded-xl border border-[var(--border)] p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{seq.title}</p>
            <Badge className="capitalize">{seq.kind.replace("_", " ")}</Badge>
            <Badge tone={seq.status === "active" ? "success" : "neutral"}>
              {seq.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{seq.description}</p>
          <ol className="mt-2 space-y-1 text-sm">
            {seq.steps.map((step, index) => (
              <li key={step.id}>
                {index + 1}. {step.label}{" "}
                <span className="text-[var(--muted)]">({step.type})</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

export function SequenceProgress({
  sequence,
  enrollment,
  busy,
  onAdvance,
}: {
  sequence: MessageSequence;
  enrollment?: SequenceEnrollment;
  busy: boolean;
  onAdvance: () => void;
}) {
  const total = sequence.steps.length;
  const current = enrollment?.currentStep ?? 0;
  const active = enrollment?.status === "active";
  const done = enrollment?.status === "completed" || current >= total;
  const remaining = Math.max(0, total - current);

  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{sequence.title}</p>
          <p className="text-xs text-[var(--muted)]">
            {done
              ? "Finished"
              : active
                ? `Next: ${sequence.steps[current]?.label || "—"} (${current + 1} of ${total})`
                : "Paused"}
            {enrollment?.lastRanAt
              ? ` · last step ${new Date(enrollment.lastRanAt).toLocaleString()}`
              : null}
          </p>
        </div>
        {active && !done ? (
          <Button size="sm" disabled={busy} onClick={onAdvance}>
            Send next
          </Button>
        ) : null}
      </div>
      {active && remaining > 0 ? (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          {remaining} step{remaining === 1 ? "" : "s"} left. There is no Day-2
          timer — Automations still own waits.
        </p>
      ) : null}
    </div>
  );
}

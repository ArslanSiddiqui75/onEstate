"use client";

import { useState } from "react";
import { UserPlus, Sparkles } from "lucide-react";
import Link from "next/link";
import { checkSeatLimit } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import type { PlanId, Role } from "@/types";

interface InviteModalProps {
  plan: PlanId;
  currentMemberCount: number;
  onInvite: (member: { name: string; email: string; role: Role }) => Promise<void>;
}

const ROLES_SELECT: Role[] = [
  "team_lead",
  "agent",
  "assistant",
  "accountant",
];

export function InviteModal({ plan, currentMemberCount, onInvite }: InviteModalProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seatCheck = checkSeatLimit(currentMemberCount, plan);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <UserPlus className="h-4 w-4" aria-hidden />
        Invite member
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="surface-panel w-full max-w-md rounded-[1.75rem] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Invite Team Member</h2>
            <p className="text-xs text-[var(--muted)]">
              Seats used: {currentMemberCount}
              {seatCheck.maxSeats !== null ? ` / ${seatCheck.maxSeats}` : " (Unlimited)"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
          >
            ✕
          </button>
        </div>

        {!seatCheck.allowed ? (
          <Alert tone="warning" className="space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              Seat limit reached
            </div>
            <p className="text-xs text-[var(--muted)]">
              Your current <strong>{plan[0].toUpperCase() + plan.slice(1)}</strong> plan allows up to{" "}
              {seatCheck.maxSeats} seat{seatCheck.maxSeats === 1 ? "" : "s"}. Upgrade your plan to invite more team members.
            </p>
            <Button asChild size="sm" className="mt-2 w-full">
              <Link href="/app/billing">Upgrade Plan</Link>
            </Button>
          </Alert>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const name = String(form.get("name") || "").trim();
              const email = String(form.get("email") || "").trim();
              const role = String(form.get("role")) as Role;

              if (!name || !email) {
                setError("Please fill in all fields");
                return;
              }

              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  await onInvite({ name, email, role });
                  toast.success(`Invitation sent to ${email}`);
                  setOpen(false);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Failed to send invite";
                  setError(msg);
                  toast.error(msg);
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {error ? <Alert tone="danger">{error}</Alert> : null}

            <div>
              <label className="text-xs font-semibold text-[var(--muted)]">Full Name</label>
              <Input name="name" placeholder="e.g. Sarah Connor" required className="mt-1" />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--muted)]">Email Address</label>
              <Input name="email" type="email" placeholder="sarah@brokerage.com" required className="mt-1" />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--muted)]">Role</label>
              <select
                name="role"
                defaultValue="agent"
                className="mt-1 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:ring-2 focus:ring-[var(--ring)]"
              >
                {ROLES_SELECT.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={busy} className="flex-1">
                {busy ? "Sending invite…" : "Send Invite"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

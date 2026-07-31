"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, CreditCard, Users2, Globe2 } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ProgressRing, Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR, TableShell } from "@/components/ui/table";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/utils";
import { PLANS } from "@/lib/plans/catalog";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { toast } from "@/components/ui/toast";
import type { PlanId } from "@/types";
import type { SubscriptionStatus, TenantLifecycleStatus } from "@/lib/admin/types";

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
  "paused",
];

const LIFECYCLE_STATUSES: TenantLifecycleStatus[] = [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
  "churned",
];

export default function AdminOrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const {
    getTenant,
    canManageBilling,
    canSuspend,
    canEditNotes,
    updatePlan,
    updateSubscriptionStatus,
    updateLifecycle,
    saveNotes,
    recentAudit,
    refresh,
  } = useAdminSession();
  const tenant = getTenant(params.id);
  const [notes, setNotes] = useState("");
  const [notesOrgId, setNotesOrgId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    refresh();
  }, [refresh, params.id]);

  if (tenant && notesOrgId !== tenant.id) {
    setNotesOrgId(tenant.id);
    setNotes(tenant.internalNotes || "");
  }

  const tenantAudit = recentAudit.filter(
    (e) => e.entityId === params.id || e.entityId === tenant?.subscription.id,
  );

  if (!tenant) {
    return (
      <Card className="py-16 text-center">
        <p className="text-sm text-[var(--muted)]">Organization not found.</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href="/admin/organizations">Back to organizations</Link>
        </Button>
      </Card>
    );
  }

  function run(action: () => void, ok: string) {
    try {
      setError("");
      action();
      setMessage(ok);
      toast.success(ok);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      setError(msg);
      toast.error(msg);
    }
  }

  const seatPct =
    tenant.subscription.seatsIncluded === 999
      ? 12
      : (tenant.subscription.seatsUsed / Math.max(tenant.subscription.seatsIncluded, 1)) * 100;

  return (
    <div className="space-y-6">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex flex-wrap items-start justify-between gap-3"
      >
        <div>
          <Link
            href="/admin/organizations"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Organizations
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={tenant.name} size="lg" />
            <div>
              <p className="text-sm text-[var(--muted)]">
                {tenant.id} · {tenant.brand} · {tenant.market.toUpperCase()} · source{" "}
                {tenant.source}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            tone={
              tenant.lifecycleStatus === "active"
                ? "success"
                : tenant.lifecycleStatus === "past_due"
                  ? "danger"
                  : tenant.lifecycleStatus === "suspended"
                    ? "warning"
                    : "neutral"
            }
            className="capitalize"
          >
            {tenant.lifecycleStatus.replace("_", " ")}
          </Badge>
          <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pl-1.5 pr-3 shadow-[var(--shadow-card)]">
            <ProgressRing
              value={tenant.healthScore}
              size={34}
              strokeWidth={4}
              tone={tenant.healthScore >= 70 ? "success" : tenant.healthScore >= 40 ? "warning" : "danger"}
            />
            <span className="text-xs font-medium text-[var(--muted)]">Health</span>
          </div>
        </div>
      </motion.div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <motion.div variants={fadeUp}>
          <Card hover className="h-full">
            <div className="stat-icon-chip"><Mail className="h-4 w-4" /></div>
            <p className="mt-3 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Owner</p>
            <p className="mt-1 font-medium">{tenant.ownerName}</p>
            <p className="text-xs text-[var(--muted)]">{tenant.ownerEmail}</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Card hover className="h-full">
            <div className="stat-icon-chip"><CreditCard className="h-4 w-4" /></div>
            <p className="mt-3 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Billing email</p>
            <p className="mt-1 font-medium">{tenant.billingEmail}</p>
            <p className="text-xs capitalize text-[var(--muted)]">
              {tenant.subscription.collectionMethod.replace("_", " ")}
            </p>
          </Card>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Card hover className="h-full">
            <div className="stat-icon-chip"><CreditCard className="h-4 w-4" /></div>
            <p className="mt-3 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">MRR</p>
            <p className="mt-1 font-display text-2xl">{formatMoney(tenant.subscription.mrr, tenant.market)}</p>
            <p className="text-xs text-[var(--muted)]">{PLANS[tenant.subscription.plan].name}</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Card hover className="h-full">
            <div className="stat-icon-chip"><Users2 className="h-4 w-4" /></div>
            <p className="mt-3 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Seats</p>
            <p className="mt-1 font-medium">
              {tenant.subscription.seatsUsed}/
              {tenant.subscription.seatsIncluded === 999 ? "∞" : tenant.subscription.seatsIncluded}
            </p>
            <Progress value={seatPct} className="mt-2" />
            <p className="mt-1.5 text-xs capitalize text-[var(--muted)]">
              Payment: {tenant.subscription.lastPaymentStatus}
            </p>
          </Card>
        </motion.div>
      </motion.div>

      <Tabs defaultValue="overview">
        <TabsBar className="lg:-top-6 lg:-mx-6 lg:px-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members ({tenant.members.length})</TabsTrigger>
            <TabsTrigger value="notes">Internal notes</TabsTrigger>
            <TabsTrigger value="audit">Audit trail</TabsTrigger>
          </TabsList>
        </TabsBar>

        <TabsContent value="overview" className="mt-4 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Subscription controls" description="Changes are audited and applied immediately" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Plan</span>
              <Select
                value={tenant.subscription.plan}
                disabled={!canManageBilling}
                onValueChange={(v) =>
                  run(() => updatePlan(tenant.id, v as PlanId), "Plan updated")
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLANS) as PlanId[]).map((plan) => (
                    <SelectItem key={plan} value={plan}>
                      {PLANS[plan].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Subscription status
              </span>
              <Select
                value={tenant.subscription.status}
                disabled={!canManageBilling}
                onValueChange={(v) =>
                  run(
                    () => updateSubscriptionStatus(tenant.id, v as SubscriptionStatus),
                    "Subscription status updated",
                  )
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Lifecycle</span>
              <Select
                value={tenant.lifecycleStatus}
                disabled={!canSuspend && tenant.lifecycleStatus !== "suspended"}
                onValueChange={(v) =>
                  run(
                    () => updateLifecycle(tenant.id, v as TenantLifecycleStatus),
                    "Lifecycle updated",
                  )
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <dl className="mt-5 grid gap-3 rounded-xl bg-[var(--surface-muted)] p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--muted)]">Stripe customer</dt>
              <dd className="font-medium">{tenant.subscription.stripeCustomerId || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Stripe subscription</dt>
              <dd className="font-medium">{tenant.subscription.stripeSubscriptionId || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Period end</dt>
              <dd className="font-medium">
                {tenant.subscription.currentPeriodEnd
                  ? new Date(tenant.subscription.currentPeriodEnd).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Trial end</dt>
              <dd className="font-medium">
                {tenant.subscription.trialEndsAt
                  ? new Date(tenant.subscription.trialEndsAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Cancel at period end</dt>
              <dd className="font-medium">{tenant.subscription.cancelAtPeriodEnd ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Next invoice</dt>
              <dd className="font-medium">
                {tenant.subscription.nextInvoiceAt
                  ? new Date(tenant.subscription.nextInvoiceAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Usage & product footprint"
            description="Live counts synced from the tenant workspace"
          />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(tenant.usage).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{key}</p>
                <p className="mt-1 font-display text-xl">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
              <Globe2 className="h-3.5 w-3.5" />
              Website:
            </span>
            <Badge tone={tenant.websitePublished ? "success" : "warning"}>
              {tenant.websitePublished ? "Published" : "Draft"}
            </Badge>
            {tenant.tags.length ? (
              <span className="flex flex-wrap gap-1.5">
                {tenant.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </span>
            ) : (
              <span className="text-xs text-[var(--muted)]">No tags</span>
            )}
          </div>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
      <Card>
        <CardHeader title={`Members (${tenant.members.length})`} />
        <div className="mt-4">
          <TableShell className="shadow-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH>Last seen</TH>
                </TR>
              </THead>
              <TBody>
                {tenant.members.map((member) => (
                  <TR key={member.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={member.name} size="sm" />
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </TD>
                    <TD>{member.email}</TD>
                    <TD>{ROLE_LABELS[member.role]}</TD>
                    <TD className="capitalize">
                      <Badge
                        tone={
                          member.status === "active"
                            ? "success"
                            : member.status === "invited"
                              ? "accent"
                              : "neutral"
                        }
                      >
                        {member.status}
                      </Badge>
                    </TD>
                    <TD className="text-xs text-[var(--muted)]">
                      {member.lastSeenAt ? new Date(member.lastSeenAt).toLocaleString() : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
        </div>
      </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
      <Card>
        <CardHeader title="Internal notes" description="Visible to platform operators only" />
        <Textarea
          className="mt-3"
          value={notes}
          disabled={!canEditNotes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {canEditNotes ? (
          <Button className="mt-3" onClick={() => run(() => saveNotes(tenant.id, notes), "Notes saved")}>
            Save notes
          </Button>
        ) : null}
      </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
      <Card>
        <CardHeader title="Tenant audit trail" />
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {tenantAudit.map((event) => (
            <li key={event.id} className="py-3 text-sm first:pt-0 last:pb-0">
              <p className="font-medium">{event.summary}</p>
              <p className="text-xs text-[var(--muted)]">
                {event.actorEmail} · {event.action} · {new Date(event.at).toLocaleString()}
              </p>
            </li>
          ))}
          {tenantAudit.length === 0 ? (
            <li className="py-6 text-center text-sm text-[var(--muted)]">No events yet.</li>
          ) : null}
        </ul>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

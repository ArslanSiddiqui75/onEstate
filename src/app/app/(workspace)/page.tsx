"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Building2, FileText, ListChecks, ArrowUpRight, Sparkles } from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { hasModuleAccess } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { PLANS } from "@/lib/plans/catalog";
import { getIntegrationStack } from "@/lib/integrations/registry";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { useAgencyBook } from "@/components/agency/use-agency-book";
import { openClientPortal } from "@/lib/agency/publish-client";
import { PORTAL_ROLE_LABELS } from "@/lib/agency/types";
import { toast } from "@/components/ui/toast";
import { formatWhen } from "@/lib/lettings/format";

export default function AppDashboardPage() {
  const { user, org, leads, listings, deals, tasks, market, brand, socialAccounts } =
    useAppSession();
  const { book } = useAgencyBook(org?.id ?? "workspace");
  if (!user || !org) return null;
  const canSocial = hasModuleAccess(user, org.plan, "social", "edit");
  const needsSocialConnect =
    canSocial && !socialAccounts.some((account) => account.status === "connected");
  const marketLeads = leads.filter((l) => l.market === market);
  const marketListings = listings.filter((l) => l.market === market);
  const marketDeals = deals.filter((d) => d.market === market);
  const openTasks = tasks.filter((t) => t.status === "open");
  const integrations = getIntegrationStack(market);
  const isEmpty =
    marketLeads.length === 0 &&
    marketListings.length === 0 &&
    marketDeals.length === 0;
  const canAddLead = hasModuleAccess(user, org.plan, "crm", "edit");
  const canAddListing = hasModuleAccess(user, org.plan, "listings", "edit");
  const today = new Date().toISOString().slice(0, 10);
  const todaysDiary = book.appointments.filter(
    (item) => item.at.slice(0, 10) === today && item.status !== "cancelled",
  );
  const openEnquiries = marketLeads.filter((lead) => lead.stage !== "won" && lead.stage !== "lost");

  return (
    <div className="space-y-6">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <Avatar name={user.name} size="lg" />
          <div>
            <p className="text-lg font-semibold tracking-tight">
              Welcome, {user.name.split(" ")[0]}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {org.name} · {ROLE_LABELS[user.role]} · {PLANS[org.plan].name} ·{" "}
              {brand.name}
            </p>
          </div>
        </div>
        {(canAddLead || canAddListing) ? (
        <div className="flex flex-wrap gap-2">
          {canAddLead ? (
          <Button asChild size="sm">
            <Link href="/app/opportunities">Add lead</Link>
          </Button>
          ) : null}
          {canAddListing ? (
          <Button asChild size="sm" variant="secondary">
            <Link href="/app/listings">Add listing</Link>
          </Button>
          ) : null}
        </div>
        ) : null}
      </motion.div>

      {isEmpty ? (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="overflow-hidden border-transparent bg-[linear-gradient(135deg,rgba(12,110,99,0.1),rgba(56,100,140,0.08))]">
            <div className="flex items-start gap-3">
              <span className="stat-icon-chip">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold">Your workspace is ready</h2>
                <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">
                  Start by adding a lead or listing. Conversations, the pipeline, and deals build from those records.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/app/opportunities">Open opportunities</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/app/listings">Open listings</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      ) : null}

      {needsSocialConnect ? (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="border-[var(--border)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <h2 className="font-semibold">Connect your social accounts</h2>
                <p className="mt-1.5 text-sm text-[var(--muted)]">
                  Link {org.name}&apos;s Instagram, Facebook, LinkedIn, or X so Social can
                  publish for this brokerage only. Other clients keep their own connections.
                </p>
              </div>
              <Button asChild>
                <Link href="/app/settings/social">Connect accounts</Link>
              </Button>
            </div>
          </Card>
        </motion.div>
      ) : null}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard label="Leads" value={marketLeads.length} icon={Users} tone="accent" />
        <StatCard label="Listings" value={marketListings.length} icon={Building2} tone="neutral" />
        <StatCard label="Open deals" value={marketDeals.length} icon={FileText} tone="success" />
        <StatCard label="Open tasks" value={openTasks.length} icon={ListChecks} tone="warning" />
      </motion.div>

      {market === "uk" ? (
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Landlord desk</h2>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
              Repair reports, the rent book, certificate dates, inspections, and a dispute pack for the lets you manage.
            </p>
          </div>
          <Button asChild>
            <Link href="/app/lettings">Open lettings</Link>
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">{market === "us" ? "Today’s calendar" : "Today’s diary"}</h2>
            <Link href="/app/diary" className="text-sm font-semibold text-[var(--accent)]">
              {market === "us" ? "Calendar" : "Diary"}
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {todaysDiary.length === 0 ? <li className="text-[var(--muted)]">Nothing booked today.</li> : null}
            {todaysDiary.map((item) => (
              <li key={item.id}>
                {formatWhen(item.at)} · {item.clientName}
                <span className="block text-xs text-[var(--muted)]">{item.address}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Open opportunities</h2>
            <Link href="/app/opportunities" className="text-sm font-semibold text-[var(--accent)]">
              {openEnquiries.length}
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {openEnquiries.slice(0, 4).map((lead) => (
              <li key={lead.id}>
                {lead.name}
                <span className="block text-xs text-[var(--muted)]">
                  {lead.source} · {lead.nextAction || lead.stage}
                </span>
              </li>
            ))}
            {openEnquiries.length === 0 ? <li className="text-[var(--muted)]">Nothing open right now.</li> : null}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Client links</h2>
            <Link href="/app/diary?section=links" className="text-sm font-semibold text-[var(--accent)]">
              Manage
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {book.portals.slice(0, 4).map((portal) => (
              <li key={portal.token}>
                <a
                  href={`/portal/${portal.token}`}
                  className="font-medium hover:underline"
                  onClick={(event) => {
                    event.preventDefault();
                    void openClientPortal(portal).catch((err: unknown) => {
                      toast.error(err instanceof Error ? err.message : "That link is not live yet.");
                    });
                  }}
                >
                  {PORTAL_ROLE_LABELS[portal.role]} · {portal.name}
                </a>
                <span className="block text-xs text-[var(--muted)]">{portal.address}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 lg:grid-cols-3"
      >
        <motion.div variants={fadeUp}>
          <Card hover className="h-full">
            <CardHeader
              title="Recent leads"
              action={
                <Link href="/app/opportunities" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline">
                  Pipeline <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {marketLeads.slice(0, 5).map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={lead.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{lead.name}</p>
                      <p className="truncate text-xs capitalize text-[var(--muted)]">
                        {lead.type} · {lead.stage}
                      </p>
                    </div>
                  </div>
                  <Badge tone="accent">{lead.score}</Badge>
                </li>
              ))}
              {marketLeads.length === 0 ? (
                <li className="py-8 text-center text-sm text-[var(--muted)]">No leads yet.</li>
              ) : null}
            </ul>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card hover className="h-full">
            <CardHeader
              title="Inventory"
              action={
                <Link href="/app/listings" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline">
                  Listings <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {marketListings.slice(0, 5).map((listing) => (
                <li key={listing.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{listing.title}</p>
                    <p className="text-xs text-[var(--muted)]">{listing.city}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">{formatMoney(listing.price, market)}</p>
                </li>
              ))}
              {marketListings.length === 0 ? (
                <li className="py-8 text-center text-sm text-[var(--muted)]">No listings yet.</li>
              ) : null}
            </ul>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card hover className="h-full">
            <CardHeader
              title="Integrations"
              action={
                <Badge tone="neutral">Coming soon</Badge>
              }
            />
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {integrations.slice(0, 5).map((provider) => (
                <li key={provider.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{provider.name}</p>
                    <p className="text-xs text-[var(--muted)]">{provider.summary}</p>
                  </div>
                  <Badge
                    tone={provider.health === "connected" ? "success" : "neutral"}
                    className="shrink-0"
                  >
                    {provider.health === "connected" ? "Connected" : "Coming soon"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

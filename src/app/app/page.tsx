"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Building2, FileText, ListChecks, ArrowUpRight, Sparkles } from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { formatMoney } from "@/lib/utils";
import { getTerminology } from "@/lib/market/terminology";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { PLANS } from "@/lib/plans/catalog";
import { getIntegrationCount, getIntegrationStack } from "@/lib/integrations/registry";
import { fadeUp, staggerContainer } from "@/lib/motion";

export default function AppDashboardPage() {
  const { user, org, leads, listings, deals, tasks, market, brand } =
    useAppSession();
  if (!user || !org) return null;
  const terms = getTerminology(market);
  const marketLeads = leads.filter((l) => l.market === market);
  const marketListings = listings.filter((l) => l.market === market);
  const marketDeals = deals.filter((d) => d.market === market);
  const openTasks = tasks.filter((t) => t.status === "open");
  const integrations = getIntegrationStack(market);
  const isEmpty =
    marketLeads.length === 0 &&
    marketListings.length === 0 &&
    marketDeals.length === 0;

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
            <h1 className="font-display text-3xl tracking-tight">
              Welcome, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {org.name} · {ROLE_LABELS[user.role]} · {PLANS[org.plan].name} ·{" "}
              {brand.name} ({terms.agent})
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/app/crm">Add lead</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/app/listings">Add listing</Link>
          </Button>
        </div>
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
                  This is the live product, not a demo. Start by adding a lead or
                  listing — CRM messaging, portal sync, and transactions will build
                  from your real records.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/app/crm">Open CRM</Link>
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
                <Link href="/app/crm" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline">
                  CRM <ArrowUpRight className="h-3.5 w-3.5" />
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
                <Badge tone="accent">{getIntegrationCount(market, "attention")} needs setup</Badge>
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
                    tone={
                      provider.health === "connected"
                        ? "success"
                        : provider.health === "planned"
                          ? "neutral"
                          : "warning"
                    }
                    className="shrink-0"
                  >
                    {provider.health}
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

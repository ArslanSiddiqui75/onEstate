"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, LayoutGrid, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/utils";
import { getIntegrationStack } from "@/lib/integrations/registry";
import { fadeUp, staggerContainer } from "@/lib/motion";
import type { ListingStatus } from "@/types";

export default function AppListingsPage() {
  const { user, org, listings, addListing, updateListingStatus, queuePortalSync, market } =
    useAppSession();
  const [showForm, setShowForm] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const marketListings = useMemo(
    () => {
      const byMarket = org ? listings.filter((l) => l.market === market) : [];
      if (!searchQuery.trim()) return byMarket;
      const q = searchQuery.toLowerCase();
      return byMarket.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q),
      );
    },
    [listings, org, market, searchQuery],
  );

  if (!user || !org) return null;

  const allowed = hasModuleAccess(user.role, org.plan, "listings", "view");
  const canEdit = hasModuleAccess(user.role, org.plan, "listings", "edit");
  const deliveryProviders = getIntegrationStack(market).filter(
    (provider) => provider.category === "portal" || provider.category === "mls",
  );

  if (!allowed) {
    return (
      <LockedModule
        title="Listings locked"
        reason="Your role cannot access listings."
        href="/app/billing"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search bar */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            placeholder="Search listings…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <span className="text-sm text-[var(--muted)]">
          {marketListings.length} listing{marketListings.length !== 1 ? "s" : ""}
        </span>
        {canEdit ? (
          <Button onClick={() => setShowForm((v) => !v)} className="ml-auto">
            {showForm ? "Close form" : "Add listing"}
          </Button>
        ) : null}
      </div>

      {showForm && canEdit ? (
        <Card>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void (async () => {
                try {
                  const title = String(form.get("title"));
                  await addListing({
                    title,
                    address: String(form.get("address")),
                    city: String(form.get("city")),
                    status: "draft",
                    price: Number(form.get("price")),
                    beds: Number(form.get("beds") || 0),
                    baths: Number(form.get("baths") || 0),
                    sqft: Number(form.get("sqft") || 0),
                    tenure:
                      market === "uk"
                        ? (String(form.get("tenure")) as "freehold" | "leasehold")
                        : undefined,
                    mlsDisclosureComplete:
                      market === "us"
                        ? form.get("mlsDisclosureComplete") === "on"
                        : undefined,
                    agentId: user.id,
                    description: String(form.get("description") || ""),
                  });
                  e.currentTarget.reset();
                  setShowForm(false);
                  toast.success(`"${title}" added as a draft listing`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to add listing");
                }
              })();
            }}
          >
            <Input name="title" placeholder="Title" required className="sm:col-span-2" />
            <Input name="address" placeholder="Address" required />
            <Input name="city" placeholder="City" required />
            <Input name="price" type="number" placeholder="Price" required />
            <Input name="beds" type="number" placeholder="Beds" />
            <Input name="baths" type="number" placeholder="Baths" />
            <Input name="sqft" type="number" placeholder="Sqft" />
            {market === "uk" ? (
              <select
                name="tenure"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="freehold"
              >
                <option value="freehold">Freehold</option>
                <option value="leasehold">Leasehold</option>
              </select>
            ) : (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="mlsDisclosureComplete" />
                MLS disclosures complete
              </label>
            )}
            <Input
              name="description"
              placeholder="Description"
              className="sm:col-span-2"
            />
            <Button type="submit" className="sm:col-span-2">
              Save listing
            </Button>
          </form>
        </Card>
      ) : null}

      <Tabs defaultValue="listings">
        <TabsBar>
          <TabsList>
            <TabsTrigger value="listings">
              <LayoutGrid className="h-3.5 w-3.5" />
              Listings
            </TabsTrigger>
            <TabsTrigger value="portals">
              <Building2 className="h-3.5 w-3.5" />
              Portal connections
            </TabsTrigger>
          </TabsList>
        </TabsBar>

        <TabsContent value="portals" className="mt-4">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid gap-3 md:grid-cols-3"
          >
            {deliveryProviders.map((provider) => (
              <motion.div key={provider.id} variants={fadeUp}>
                <Card hover>
                  <p className="text-sm font-medium">{provider.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{provider.summary}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    {provider.credentialOwner}
                  </p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        <TabsContent value="listings" className="mt-4">
      {marketListings.length === 0 ? (
        <EmptyState
          title="No listings yet"
          description="Add your first listing to start distributing to portals."
        />
      ) : (
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2"
      >
        {marketListings.map((listing) => (
          <motion.article
            key={listing.id}
            variants={fadeUp}
            className="data-card data-card-hover overflow-hidden"
          >
            <div className="relative h-40 w-full">
              <Image
                src={listing.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width:768px) 100vw, 50vw"
              />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-3 left-4 font-display text-2xl text-white drop-shadow">
                {formatMoney(listing.price, market)}
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{listing.title}</h2>
                {canEdit ? (
                  <select
                    className="h-8 rounded-md border border-[var(--border)] px-2 text-xs capitalize"
                    value={listing.status}
                    onChange={(e) =>
                      void updateListingStatus(
                        listing.id,
                        e.target.value as ListingStatus,
                      )
                    }
                  >
                    {[
                      "draft",
                      "active",
                      "under_offer",
                      "sold",
                      "let",
                      "withdrawn",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge className="capitalize">
                    {listing.status.replace("_", " ")}
                  </Badge>
                )}
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                  <span>Sync readiness</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {listing.syncReadiness ?? 0}%
                  </span>
                </div>
                <Progress
                  value={listing.syncReadiness ?? 0}
                  className="mt-1.5"
                  tone={
                    (listing.syncReadiness ?? 0) >= 80
                      ? "success"
                      : (listing.syncReadiness ?? 0) >= 40
                        ? "warning"
                        : "danger"
                  }
                />
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {listing.nextMilestone || "Next milestone pending"}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {listing.portals.map((p) => (
                  <Badge key={p.portal}>
                    {p.portal} · {p.status.replace("_", " ")}
                  </Badge>
                ))}
              </div>
              {listing.complianceIssues?.length ? (
                <Alert tone="danger" className="mt-3">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {listing.complianceIssues.join(" · ")}
                  </span>
                </Alert>
              ) : (
                <Alert tone="success" className="mt-3">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Compliance pack complete for current sync stage.
                  </span>
                </Alert>
              )}
              {canEdit ? (
              <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={syncingId === listing.id}
                    onClick={async () => {
                      setSyncingId(listing.id);
                      try {
                        const msg = await queuePortalSync(listing.id);
                        toast.success(msg || "Sync queued successfully");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Sync failed");
                      } finally {
                        setSyncingId(null);
                      }
                    }}
                  >
                    {syncingId === listing.id ? "Queuing…" : "Validate & queue portal sync"}
                  </Button>
                  {listing.status !== "under_offer" ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        void updateListingStatus(listing.id, "under_offer")
                      }
                    >
                      Start transaction
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.article>
        ))}
      </motion.div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

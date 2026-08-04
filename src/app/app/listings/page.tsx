"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Edit, ExternalLink, Eye, LayoutGrid, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
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
import type { Listing, ListingStatus } from "@/types";

export default function AppListingsPage() {
  const { user, org, listings, addListing, updateListingStatus, queuePortalSync, market } =
    useAppSession();
  const [showForm, setShowForm] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [portalLogListing, setPortalLogListing] = useState<Listing | null>(null);

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
            <div
              className="relative h-40 w-full cursor-pointer group"
              onClick={() => setPreviewImage(listing.imageUrl)}
              title="Click to view full image"
            >
              <Image
                src={listing.imageUrl}
                alt={listing.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width:768px) 100vw, 50vw"
              />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm text-white p-1.5 rounded-full">
                <Eye className="h-4 w-4" />
              </div>
              <div className="absolute bottom-3 left-4 font-display text-2xl text-white drop-shadow">
                {formatMoney(listing.price, market)}
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{listing.title}</h2>
                  <p className="text-xs text-[var(--muted)]">{listing.address}, {listing.city}</p>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingListing(listing)}
                      title="Edit listing details"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
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
                  </div>
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
                  <button
                    key={p.portal}
                    type="button"
                    onClick={() => setPortalLogListing(listing)}
                    title="Click for portal sync status detail"
                  >
                    <Badge className="cursor-pointer hover:opacity-80">
                      {p.portal} · {p.status.replace("_", " ")}
                    </Badge>
                  </button>
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

      {/* Image Lightbox Modal */}
      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[85vh] h-[500px]" onClick={(e) => e.stopPropagation()}>
            <Image src={previewImage} alt="Listing preview" fill className="object-contain" />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 rounded-full bg-black/70 p-2 text-white hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Portal Log Modal */}
      {portalLogListing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="surface-panel w-full max-w-md rounded-[1.75rem] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Portal Sync Logs</h2>
              <button type="button" onClick={() => setPortalLogListing(null)} className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">Sync status for <strong>{portalLogListing.title}</strong> across target channels.</p>
            <div className="space-y-2">
              {portalLogListing.portals.map((p) => (
                <div key={p.portal} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]">
                  <div>
                    <p className="font-medium text-sm capitalize">{p.portal}</p>
                    <p className="text-xs text-[var(--muted)]">Last synced: {portalLogListing.lastSyncAt ? new Date(portalLogListing.lastSyncAt).toLocaleString() : "Recently"}</p>
                  </div>
                  <Badge tone={p.status === "synced" ? "success" : p.status === "error" ? "danger" : "neutral"} className="capitalize">
                    {p.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => setPortalLogListing(null)}>Close</Button>
          </div>
        </div>
      ) : null}

      {/* Edit Listing Modal */}
      {editingListing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="surface-panel w-full max-w-lg rounded-[1.75rem] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Listing</h2>
              <button type="button" onClick={() => setEditingListing(null)} className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const title = String(form.get("title"));
                const price = Number(form.get("price"));
                editingListing.title = title;
                editingListing.address = String(form.get("address"));
                editingListing.city = String(form.get("city"));
                editingListing.price = price;
                editingListing.beds = Number(form.get("beds"));
                editingListing.baths = Number(form.get("baths"));
                editingListing.sqft = Number(form.get("sqft"));
                editingListing.description = String(form.get("description"));
                if (form.get("imageUrl")) editingListing.imageUrl = String(form.get("imageUrl"));
                toast.success(`Updated "${title}"`);
                setEditingListing(null);
              }}
            >
              <Input name="title" placeholder="Title" defaultValue={editingListing.title} required className="sm:col-span-2" />
              <Input name="address" placeholder="Address" defaultValue={editingListing.address} required />
              <Input name="city" placeholder="City" defaultValue={editingListing.city} required />
              <Input name="price" type="number" placeholder="Price" defaultValue={editingListing.price} required />
              <Input name="beds" type="number" placeholder="Beds" defaultValue={editingListing.beds} />
              <Input name="baths" type="number" placeholder="Baths" defaultValue={editingListing.baths} />
              <Input name="sqft" type="number" placeholder="Sqft" defaultValue={editingListing.sqft} />
              <Input name="imageUrl" placeholder="Image URL" defaultValue={editingListing.imageUrl} className="sm:col-span-2" />
              <Input name="description" placeholder="Description" defaultValue={editingListing.description} className="sm:col-span-2" />
              <div className="flex gap-2 sm:col-span-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEditingListing(null)} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1">Save changes</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

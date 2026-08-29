"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  CheckSquare,
  AlertTriangle,
  Plus,
  Download,
  X,
  Copy,
  PenLine,
} from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatMoney } from "@/lib/utils";
import { fadeUp, staggerContainer } from "@/lib/motion";
import type { TransactionDeal, TransactionEsignDocument } from "@/types";

const STAGES = [
  "Instruction",
  "Under offer",
  "Exchange prep",
  "Under contract",
  "Closing",
];

export default function AppTransactionsPage() {
  const {
    user,
    org,
    deals,
    listings,
    market,
    updateDealChecklistItem,
    addDealChecklistItem,
    updateDealMeta,
    createManualDeal,
    requestEsign,
    listEsignDocuments,
    voidEsignDocument,
  } = useAppSession();
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState<Record<string, string>>({});
  const [esignDocs, setEsignDocs] = useState<Record<string, TransactionEsignDocument[]>>(
    {},
  );
  const [esignForm, setEsignForm] = useState<
    Record<string, { name: string; email: string; documentName: string }>
  >({});
  const [busyDeal, setBusyDeal] = useState<string | null>(null);

  const canEdit = user && org ? hasModuleAccess(user.role, org.plan, "transactions", "edit") : false;

  const refreshDocs = useCallback(
    async (dealId: string) => {
      const docs = await listEsignDocuments(dealId);
      setEsignDocs((prev) => ({ ...prev, [dealId]: docs }));
    },
    [listEsignDocuments],
  );

  useEffect(() => {
    for (const deal of deals.filter((d) => d.market === market)) {
      void refreshDocs(deal.id);
    }
  }, [deals, market, refreshDocs]);

  if (!user || !org) return null;
  if (!hasModuleAccess(user.role, org.plan, "transactions", "view")) {
    return (
      <LockedModule
        title="Transactions locked"
        reason="Your role cannot view transactions."
        href="/app/billing"
      />
    );
  }

  const marketDeals = deals.filter((deal) => deal.market === market);
  const marketListings = listings.filter((l) => l.market === market);

  function exportDealSummary(deal: TransactionDeal) {
    const doneCount = deal.checklist.filter((i) => i.done).length;
    const summary = `
========================================
TRANSACTION SUMMARY REPORT: ${deal.listingTitle}
========================================
Market: ${deal.market.toUpperCase()}
Value: ${formatMoney(deal.value, deal.market)}
Stage: ${deal.stage}
Parties: ${deal.parties.join(" · ")}
Target Close Date: ${deal.targetCloseDate ? formatDate(deal.targetCloseDate, deal.market) : "N/A"}
E-Sign Status: ${deal.eSignStatus}
Compliance Status: ${deal.complianceStatus || "on_track"}
Ledger Status: ${deal.ledgerStatus || "not_started"}
Checklist Progress: ${doneCount}/${deal.checklist.length} items completed

CHECKLIST DETAILS:
${deal.checklist.map((item, idx) => `${idx + 1}. [${item.done ? "X" : " "}] ${item.label}`).join("\n")}

NOTES:
${deal.notes || "No notes attached."}

Generated on ${new Date().toLocaleString()} by 0nEstate platform.
========================================
`.trim();

    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deal_summary_${deal.listingTitle.replace(/[^a-z0-9]/gi, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Exported deal summary report");
  }

  if (marketDeals.length === 0 && !showNewDealModal) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Transactions & Conveyancing</h1>
          {canEdit ? (
            <Button onClick={() => setShowNewDealModal(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
          ) : null}
        </div>
        <EmptyState
          title="No active transactions"
          description="Deals are created when a listing moves to Under Offer, when a lead is marked Won, or when you add one here."
        />
        {showNewDealModal ? (
          <NewDealModal
            listings={marketListings}
            onClose={() => setShowNewDealModal(false)}
            onCreate={async (input) => {
              await createManualDeal(input);
              toast.success(`Created transaction "${input.listingTitle}"`);
              setShowNewDealModal(false);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Transactions & Conveyancing</h1>
        {canEdit ? (
          <Button onClick={() => setShowNewDealModal(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add transaction
          </Button>
        ) : null}
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-4"
      >
        <StatCard label="Open deals" value={marketDeals.length} icon={FileText} tone="accent" />
        <StatCard
          label="Attention required"
          value={marketDeals.filter((deal) => deal.complianceStatus === "attention").length}
          icon={CheckSquare}
          tone="warning"
        />
        <StatCard
          label="E-sign sent / signed"
          value={
            marketDeals.filter(
              (deal) => deal.eSignStatus === "sent" || deal.eSignStatus === "signed",
            ).length
          }
          icon={PenLine}
          tone="success"
        />
        <StatCard
          label="Deal value"
          value={formatMoney(marketDeals.reduce((sum, deal) => sum + deal.value, 0), market)}
          icon={FileText}
          tone="neutral"
        />
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
        {marketDeals.map((deal) => {
          const form = esignForm[deal.id] || {
            name: deal.parties[0] || "",
            email: "",
            documentName: market === "uk" ? "Sale contract" : "Purchase agreement",
          };
          const docs = esignDocs[deal.id] || [];
          return (
            <motion.article key={deal.id} variants={fadeUp}>
              <Card hover>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{deal.listingTitle}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {deal.parties.join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => exportDealSummary(deal)}
                      className="gap-1.5 text-xs"
                      title="Download text summary report"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export Summary
                    </Button>
                    <div className="text-right">
                      <p className="font-display text-2xl">
                        {formatMoney(deal.value, market)}
                      </p>
                      {deal.targetCloseDate ? (
                        <p
                          className={`text-xs ${
                            new Date(deal.targetCloseDate) < new Date()
                              ? "font-semibold text-[var(--danger)] flex items-center gap-1 justify-end"
                              : "text-[var(--muted)]"
                          }`}
                        >
                          {new Date(deal.targetCloseDate) < new Date() && (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {new Date(deal.targetCloseDate) < new Date()
                            ? "Overdue · "
                            : "Target close "}
                          {formatDate(deal.targetCloseDate, market)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="accent">{deal.stage}</Badge>
                  <Badge
                    tone={
                      deal.eSignStatus === "signed"
                        ? "success"
                        : deal.eSignStatus === "sent"
                          ? "warning"
                          : deal.eSignStatus === "voided"
                            ? "danger"
                            : "neutral"
                    }
                  >
                    E-Sign:{" "}
                    {deal.eSignStatus
                      ? deal.eSignStatus.replace("_", " ")
                      : "not started"}
                  </Badge>
                  <Badge
                    tone={
                      deal.complianceStatus === "blocked"
                        ? "danger"
                        : deal.complianceStatus === "attention"
                          ? "warning"
                          : "success"
                    }
                  >
                    Compliance: {deal.complianceStatus || "on_track"}
                  </Badge>
                  <Badge>Ledger: {deal.ledgerStatus || "not_started"}</Badge>
                </div>

                <Tabs defaultValue="checklist" className="mt-5">
                  <TabsList>
                    <TabsTrigger value="checklist">Checklist</TabsTrigger>
                    <TabsTrigger value="esign">E-sign</TabsTrigger>
                    <TabsTrigger value="details">Deal details</TabsTrigger>
                  </TabsList>

                  <TabsContent value="checklist" className="mt-4">
                    {(() => {
                      const done = deal.checklist.filter((i) => i.done).length;
                      const total = deal.checklist.length;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                            <span>Checklist progress</span>
                            <span className="font-medium text-[var(--foreground)]">
                              {done}/{total} complete
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                backgroundColor:
                                  pct === 100
                                    ? "var(--success)"
                                    : pct >= 50
                                      ? "var(--warning)"
                                      : "var(--accent)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {deal.checklist.map((item) => (
                        <li
                          key={item.id}
                          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                            item.done
                              ? "border-transparent bg-[var(--success-soft)]"
                              : "border-[var(--border)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            disabled={!canEdit}
                            onChange={(e) => {
                              void updateDealChecklistItem(
                                deal.id,
                                item.id,
                                e.target.checked,
                              ).then(() => {
                                if (e.target.checked) {
                                  toast.success(`"${item.label}" marked done`);
                                }
                              });
                            }}
                            className="h-4 w-4 accent-[var(--accent)]"
                          />
                          <span
                            className={item.done ? "text-[var(--success)] line-through" : ""}
                          >
                            {item.label}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {canEdit ? (
                      <form
                        className="mt-3 flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const label = newItemLabel[deal.id]?.trim();
                          if (!label) return;
                          void addDealChecklistItem(deal.id, label).then(() => {
                            setNewItemLabel((prev) => ({ ...prev, [deal.id]: "" }));
                            toast.success(`Added "${label}" to checklist`);
                          });
                        }}
                      >
                        <Input
                          placeholder="Add custom compliance item…"
                          value={newItemLabel[deal.id] || ""}
                          onChange={(e) =>
                            setNewItemLabel((prev) => ({
                              ...prev,
                              [deal.id]: e.target.value,
                            }))
                          }
                          className="h-9 text-xs"
                        />
                        <Button type="submit" size="sm" variant="secondary" className="gap-1">
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                      </form>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="esign" className="mt-4 space-y-4">
                    <p className="text-sm text-[var(--muted)]">
                      Request a signature link for the buyer/seller. When Resend is
                      configured the invite emails; otherwise copy the link. Live Dropbox
                      Sign can plug in later via <code>DROPBOX_SIGN_API_KEY</code>.
                    </p>
                    {canEdit ? (
                      <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:grid-cols-2">
                        <Input
                          placeholder="Signer name"
                          value={form.name}
                          onChange={(e) =>
                            setEsignForm((prev) => ({
                              ...prev,
                              [deal.id]: { ...form, name: e.target.value },
                            }))
                          }
                        />
                        <Input
                          type="email"
                          placeholder="Signer email"
                          value={form.email}
                          onChange={(e) =>
                            setEsignForm((prev) => ({
                              ...prev,
                              [deal.id]: { ...form, email: e.target.value },
                            }))
                          }
                        />
                        <Input
                          className="sm:col-span-2"
                          placeholder="Document name"
                          value={form.documentName}
                          onChange={(e) =>
                            setEsignForm((prev) => ({
                              ...prev,
                              [deal.id]: { ...form, documentName: e.target.value },
                            }))
                          }
                        />
                        <Button
                          type="button"
                          className="sm:col-span-2"
                          disabled={busyDeal === deal.id}
                          onClick={() => {
                            void (async () => {
                              setBusyDeal(deal.id);
                              try {
                                const result = await requestEsign({
                                  dealId: deal.id,
                                  signerName: form.name,
                                  signerEmail: form.email,
                                  documentName: form.documentName,
                                });
                                await refreshDocs(deal.id);
                                if (result.signUrl) {
                                  await navigator.clipboard.writeText(result.signUrl);
                                  toast.success(
                                    result.emailed
                                      ? "Invite emailed — sign link also copied"
                                      : "Sign link copied to clipboard",
                                  );
                                } else {
                                  toast.success(
                                    "E-sign marked sent (local workspace — no public link)",
                                  );
                                }
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "E-sign failed",
                                );
                              } finally {
                                setBusyDeal(null);
                              }
                            })();
                          }}
                        >
                          {busyDeal === deal.id ? "Sending…" : "Request signature"}
                        </Button>
                      </div>
                    ) : null}

                    {docs.length ? (
                      <ul className="space-y-2">
                        {docs.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-xs text-[var(--muted)]">
                                {doc.signerName} · {doc.signerEmail} · {doc.status}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {doc.signToken && doc.status === "sent" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="gap-1"
                                  onClick={() => {
                                    const url = `${window.location.origin}/sign/${doc.signToken}`;
                                    void navigator.clipboard.writeText(url);
                                    toast.success("Sign link copied");
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy link
                                </Button>
                              ) : null}
                              {canEdit && doc.status === "sent" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    void voidEsignDocument({
                                      dealId: deal.id,
                                      documentId: doc.id,
                                    })
                                      .then(() => refreshDocs(deal.id))
                                      .then(() => toast.info("Document voided"));
                                  }}
                                >
                                  Void
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">No signature requests yet.</p>
                    )}
                  </TabsContent>

                  <TabsContent value="details" className="mt-4">
                    <div className="grid gap-3 rounded-xl bg-[var(--surface-muted)] p-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          Stage
                        </label>
                        <Select
                          value={deal.stage}
                          onValueChange={(v) => {
                            void updateDealMeta(deal.id, { stage: v }).then(() =>
                              toast.info(`Stage updated to "${v}"`),
                            );
                          }}
                        >
                          <SelectTrigger className="mt-1 bg-[var(--surface)]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGES.map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {stage}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          Ledger
                        </label>
                        <Select
                          value={deal.ledgerStatus || "not_started"}
                          onValueChange={(v) =>
                            void updateDealMeta(deal.id, {
                              ledgerStatus: v as typeof deal.ledgerStatus,
                            })
                          }
                        >
                          <SelectTrigger className="mt-1 bg-[var(--surface)]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">Not started</SelectItem>
                            <SelectItem value="in_progress">In progress</SelectItem>
                            <SelectItem value="reconciled">Reconciled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          Notes
                        </label>
                        <Textarea
                          className="mt-1 bg-[var(--surface)]"
                          value={deal.notes || ""}
                          onChange={(e) =>
                            void updateDealMeta(deal.id, { notes: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>
            </motion.article>
          );
        })}
      </motion.div>

      {showNewDealModal ? (
        <NewDealModal
          listings={marketListings}
          onClose={() => setShowNewDealModal(false)}
          onCreate={async (input) => {
            await createManualDeal(input);
            toast.success(`Created transaction "${input.listingTitle}"`);
            setShowNewDealModal(false);
          }}
        />
      ) : null}
    </div>
  );
}

function NewDealModal({
  listings,
  onClose,
  onCreate,
}: {
  listings: { id: string; title: string; price: number }[];
  onClose: () => void;
  onCreate: (input: {
    listingTitle: string;
    value: number;
    parties: string[];
    targetCloseDate?: string;
    listingId?: string;
  }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="surface-panel w-full max-w-md rounded-[1.75rem] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Transaction Deal</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const listingId = String(form.get("listingId") || "");
            const listing = listings.find((l) => l.id === listingId);
            const title = String(form.get("title") || listing?.title || "").trim();
            const value = Number(form.get("value") || listing?.price || 0);
            const party1 = String(form.get("party1") || "Buyer");
            const party2 = String(form.get("party2") || "Seller");
            const targetCloseDate = String(form.get("targetCloseDate") || "");
            if (!title) return;
            setBusy(true);
            void onCreate({
              listingTitle: title,
              value,
              parties: [party1, party2],
              targetCloseDate: targetCloseDate || undefined,
              listingId: listingId || undefined,
            }).finally(() => setBusy(false));
          }}
        >
          {listings.length ? (
            <select
              name="listingId"
              className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              defaultValue=""
              onChange={(e) => {
                const listing = listings.find((l) => l.id === e.target.value);
                if (!listing) return;
                const form = e.currentTarget.form;
                if (!form) return;
                const title = form.elements.namedItem("title") as HTMLInputElement | null;
                const value = form.elements.namedItem("value") as HTMLInputElement | null;
                if (title && !title.value) title.value = listing.title;
                if (value && !value.value) value.value = String(listing.price);
              }}
            >
              <option value="">Link listing (optional)</option>
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title}
                </option>
              ))}
            </select>
          ) : null}
          <Input name="title" placeholder="Property / Deal Title" required />
          <Input name="value" type="number" placeholder="Deal Value" required />
          <div className="grid grid-cols-2 gap-2">
            <Input name="party1" placeholder="Party 1 (Buyer/Tenant)" required />
            <Input name="party2" placeholder="Party 2 (Seller/Landlord)" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--muted)]">
              Target Close Date
            </label>
            <Input name="targetCloseDate" type="date" className="mt-1" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Creating…" : "Create Deal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

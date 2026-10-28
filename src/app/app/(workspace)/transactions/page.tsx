"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Plus,
  Download,
  X,
  Copy,
  Trash2,
} from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import {
  MenuSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copyToClipboard, formatDate, formatMoney } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";
import type { Market, TransactionDeal, TransactionEsignDocument } from "@/types";
import { useAgencyBook } from "@/components/agency/use-agency-book";
import {
  addFee,
  addOffer,
  addReferral,
  createFee,
  createOffer,
  createReferral,
  draftSaleSummary,
  setFeeStatus,
} from "@/lib/agency/book";
import type { AgencyBook } from "@/lib/agency/types";

function progressionStages(market: Market, current: string) {
  const base =
    market === "us"
      ? ["Listed", "Showing", "Offer", "Progressing", "Closed"]
      : ["Listed", "Viewing", "Offer", "Progressing", "Exchanged"];
  return base.includes(current) ? base : [current, ...base];
}

export function DealsBoard() {
  const {
    user,
    org,
    deals,
    listings,
    brand,
    market,
    updateDealChecklistItem,
    addDealChecklistItem,
    updateDealMeta,
    createManualDeal,
    archiveDeal,
    requestEsign,
    listEsignDocuments,
    voidEsignDocument,
  } = useAppSession();
  const { book: agency, commit: commitAgency } = useAgencyBook(org?.id ?? "workspace");
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState<Record<string, string>>({});
  const [esignDocs, setEsignDocs] = useState<Record<string, TransactionEsignDocument[]>>(
    {},
  );
  const [esignForm, setEsignForm] = useState<
    Record<string, { name: string; email: string; documentName: string }>
  >({});
  const [busyDeal, setBusyDeal] = useState<string | null>(null);
  const [openDealId, setOpenDealId] = useState<string | null>(null);

  const canEdit = user && org ? hasModuleAccess(user, org.plan, "transactions", "edit") : false;

  const refreshDocs = useCallback(
    async (dealId: string) => {
      const docs = await listEsignDocuments(dealId);
      setEsignDocs((prev) => ({ ...prev, [dealId]: docs }));
    },
    [listEsignDocuments],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      for (const deal of deals.filter((d) => d.market === market)) {
        void refreshDocs(deal.id);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [deals, market, refreshDocs]);

  if (!user || !org) return null;
  if (!hasModuleAccess(user, org.plan, "transactions", "view")) {
    return (
      <LockedModule
        title="Transactions locked"
        reason="Your role cannot view transactions."
        role={user.role}
        moduleAccess={user.moduleAccess}
        plan={org.plan}
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

Generated on ${new Date().toLocaleString()} by ${brand.name}.
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
          <div>
            <h2 className="text-lg font-semibold">Deals</h2>
            <p className="text-sm text-[var(--muted)]">A deal is a listing that is moving toward close.</p>
          </div>
          {canEdit ? (
            <Button onClick={() => setShowNewDealModal(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New deal
            </Button>
          ) : null}
        </div>
        <EmptyState
          title="No deals yet"
          description="A deal appears when a listing goes under offer, a lead is marked won, or you add one here."
        />
        {showNewDealModal ? (
          <NewDealModal
            listings={marketListings}
            onClose={() => setShowNewDealModal(false)}
            onCreate={async (input) => {
              try {
                await createManualDeal(input);
                toast.success(`Created transaction "${input.listingTitle}"`);
                setShowNewDealModal(false);
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Failed to create transaction",
                );
              }
            }}
          />
        ) : null}
      </div>
    );
  }

  const selected = marketDeals.find((deal) => deal.id === openDealId) || marketDeals[0];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">
          {marketDeals.length} open {marketDeals.length === 1 ? "deal" : "deals"}. Open one, then work the checklist, signature, or money.
        </p>
        {canEdit ? (
          <Button onClick={() => setShowNewDealModal(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New deal
          </Button>
        ) : null}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[17rem_1fr]">
        <aside className="space-y-2">
          {marketDeals.map((deal) => {
            const done = deal.checklist.filter((item) => item.done).length;
            const total = deal.checklist.length;
            const active = selected?.id === deal.id;
            return (
              <button
                key={deal.id}
                type="button"
                onClick={() => setOpenDealId(deal.id)}
                className={`w-full rounded-[1rem] border px-3 py-3 text-left ${
                  active
                    ? "border-[var(--accent)] bg-[var(--surface)]"
                    : "border-[var(--border)] bg-[var(--surface-muted)]"
                }`}
              >
                <p className="truncate font-medium">{deal.listingTitle}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {formatMoney(deal.value, market)} · {deal.stage}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {done}/{total || 0} checklist
                </p>
              </button>
            );
          })}
        </aside>

        <div className="min-w-0">
        {selected ? [selected].map((deal) => {
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
                    {canEdit ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Archive ${deal.listingTitle}? It leaves the deals list.`,
                            )
                          ) {
                            void archiveDeal(deal.id)
                              .then(() => toast.success("Deal archived"))
                              .catch((err) =>
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not archive",
                                ),
                              );
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Archive
                      </Button>
                    ) : null}
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

                <ol className="mt-4 flex flex-wrap gap-2">
                  {progressionStages(market, deal.stage).map((stage) => {
                    const current = stage === deal.stage;
                    return (
                      <li key={stage}>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => {
                            void updateDealMeta(deal.id, { stage }).then(() =>
                              toast.info(`Stage updated to "${stage}"`),
                            );
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            current
                              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                              : "border border-[var(--border)] text-[var(--muted)]"
                          }`}
                        >
                          {stage}
                        </button>
                      </li>
                    );
                  })}
                </ol>

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
                      Request a signature link for the buyer or seller. When email is
                      configured the invite is sent; otherwise copy the link.
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
                                  const copied = await copyToClipboard(result.signUrl);
                                  toast.success(
                                    result.emailed
                                      ? copied
                                        ? "Invite emailed — sign link also copied"
                                        : "Invite emailed"
                                      : copied
                                        ? "Sign link copied to clipboard"
                                        : `Sign link: ${result.signUrl}`,
                                  );
                                } else {
                                  toast.success(
                                    "Signature request saved",
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
                                    void copyToClipboard(url).then((ok) =>
                                      ok ? toast.success("Sign link copied") : toast.info(`Sign link: ${url}`),
                                    );
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
                            {progressionStages(market, deal.stage).map((stage) => (
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
                    <DealMoney
                      deal={deal}
                      agency={agency}
                      canEdit={canEdit}
                      commitAgency={commitAgency}
                      onSummary={(notes) => updateDealMeta(deal.id, { notes })}
                      onStage={(stage) => updateDealMeta(deal.id, { stage })}
                    />
                  </TabsContent>
                </Tabs>
              </Card>
            </motion.article>
          );
        }) : null}
        </div>
      </div>

      {showNewDealModal ? (
        <NewDealModal
          listings={marketListings}
          onClose={() => setShowNewDealModal(false)}
          onCreate={async (input) => {
            try {
              await createManualDeal(input);
              toast.success(`Created transaction "${input.listingTitle}"`);
              setShowNewDealModal(false);
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Failed to create transaction",
              );
            }
          }}
        />
      ) : null}
    </div>
  );
}

export default function AppTransactionsPage() {
  return <DealsBoard />;
}

function DealMoney({
  deal,
  agency,
  canEdit,
  commitAgency,
  onSummary,
  onStage,
}: {
  deal: TransactionDeal;
  agency: AgencyBook;
  canEdit: boolean;
  commitAgency: (next: AgencyBook) => void;
  onSummary: (notes: string) => Promise<void>;
  onStage: (stage: string) => Promise<void>;
}) {
  const fees = agency.fees.filter((item) => item.dealId === deal.id || item.address === deal.listingTitle);
  const referrals = agency.referrals.filter((item) => item.dealId === deal.id || item.address === deal.listingTitle);
  const offers = agency.offers.filter((item) => item.listingId === deal.listingId || item.address === deal.listingTitle);
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const notes = draftSaleSummary({
              listingTitle: deal.listingTitle,
              stage: deal.stage,
              parties: deal.parties,
              checklist: deal.checklist,
              notes: deal.notes,
              value: deal.value,
              currency: deal.currency,
            });
            void onSummary(notes).then(() => toast.success("Sale summary drafted into notes"));
          }}
        >
          Draft sale summary
        </Button>
      </div>
      <div>
        <p className="text-sm font-semibold">Offers on this deal</p>
        <ul className="mt-2 space-y-1 text-sm">
          {offers.map((offer) => (
            <li key={offer.id}>
              {offer.buyerName} · {formatMoney(offer.amount, deal.market)} · {offer.status}
            </li>
          ))}
          {offers.length === 0 ? <li className="text-[var(--muted)]">No offer recorded yet.</li> : null}
        </ul>
        {canEdit ? (
          <form
            className="mt-2 grid gap-2 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              try {
                const offer = createOffer({
                  address: deal.listingTitle,
                  buyerName: String(data.get("buyerName") || ""),
                  amount: Number(data.get("amount")),
                  currency: deal.currency,
                  notes: String(data.get("notes") || ""),
                  listingId: deal.listingId,
                });
                commitAgency(addOffer(agency, offer));
                void onStage("Offer");
                event.currentTarget.reset();
                toast.success("Offer recorded");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not record that offer.");
              }
            }}
          >
            <Input name="buyerName" placeholder="Buyer" aria-label="Buyer" required />
            <Input name="amount" type="number" min={1} placeholder="Amount" aria-label="Offer amount" required />
            <Input name="notes" placeholder="Conditions" aria-label="Conditions" />
            <Button type="submit" size="sm" className="sm:col-span-3">
              Record offer
            </Button>
          </form>
        ) : null}
      </div>
      <div>
        <p className="text-sm font-semibold">Fee request</p>
        <p className="text-xs text-[var(--muted)]">Stored on this deal. Mark it received when the money arrives.</p>
        <ul className="mt-2 space-y-1 text-sm">
          {fees.map((fee) => (
            <li key={fee.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {fee.label} · {formatMoney(fee.amount, deal.market)} · {fee.status}
              </span>
              {canEdit && fee.status === "requested" ? (
                <Button size="sm" variant="secondary" onClick={() => commitAgency(setFeeStatus(agency, fee.id, "received"))}>
                  Mark received
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form
            className="mt-2 grid gap-2 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              try {
                commitAgency(
                  addFee(
                    agency,
                    createFee({
                      dealId: deal.id,
                      address: deal.listingTitle,
                      label: String(data.get("label") || ""),
                      amount: Number(data.get("amount")),
                      currency: deal.currency,
                    }),
                  ),
                );
                event.currentTarget.reset();
                toast.success("Fee requested");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not request that fee.");
              }
            }}
          >
            <Input name="label" placeholder="Sales fee" aria-label="Fee label" required />
            <Input name="amount" type="number" min={1} placeholder="Amount" aria-label="Fee amount" required />
            <Button type="submit" size="sm">
              Request fee
            </Button>
          </form>
        ) : null}
      </div>
      <div>
        <p className="text-sm font-semibold">Referral</p>
        <ul className="mt-2 space-y-1 text-sm">
          {referrals.map((item) => (
            <li key={item.id}>
              {item.introducer} · {formatMoney(item.fee, deal.market)} · {item.status}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form
            className="mt-2 grid gap-2 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              try {
                commitAgency(
                  addReferral(
                    agency,
                    createReferral({
                      dealId: deal.id,
                      address: deal.listingTitle,
                      introducer: String(data.get("introducer") || ""),
                      fee: Number(data.get("fee")),
                      currency: deal.currency,
                    }),
                  ),
                );
                event.currentTarget.reset();
                toast.success("Referral noted");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save that referral.");
              }
            }}
          >
            <Input name="introducer" placeholder="Introducer" aria-label="Introducer" required />
            <Input name="fee" type="number" min={0} placeholder="Fee" aria-label="Referral fee" required />
            <Button type="submit" size="sm">
              Add referral
            </Button>
          </form>
        ) : null}
      </div>
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
            <MenuSelect
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
            </MenuSelect>
          ) : null}
          <Input name="title" placeholder="Property / Deal Title" required />
          <Input name="value" type="number" min={1} step="any" placeholder="Deal Value" required />
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

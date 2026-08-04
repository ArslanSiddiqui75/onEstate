"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, CheckSquare, AlertTriangle, Plus, Download, X } from "lucide-react";
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
import type { TransactionDeal } from "@/types";

const STAGES = [
  "Instruction",
  "Under offer",
  "Exchange prep",
  "Under contract",
  "Closing",
];

export default function AppTransactionsPage() {
  const { user, org, deals, market, updateDealChecklistItem, updateDealMeta } =
    useAppSession();
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState<Record<string, string>>({});

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

  function exportDealSummary(deal: TransactionDeal) {
    const doneCount = deal.checklist.filter(i => i.done).length;
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

  // Empty state
  if (marketDeals.length === 0) {
    return (
      <EmptyState
        title="No active transactions"
        description="Transactions are created automatically when a listing moves to Under Offer."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Transactions & Conveyancing</h1>
        <Button onClick={() => setShowNewDealModal(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add transaction
        </Button>
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
          label="Ledger reconciled"
          value={marketDeals.filter((deal) => deal.ledgerStatus === "reconciled").length}
          icon={CheckSquare}
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
        {marketDeals.map((deal) => (
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
                      <p className={`text-xs ${
                        new Date(deal.targetCloseDate) < new Date()
                          ? "font-semibold text-[var(--danger)] flex items-center gap-1 justify-end"
                          : "text-[var(--muted)]"
                      }`}>
                        {new Date(deal.targetCloseDate) < new Date() && (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {new Date(deal.targetCloseDate) < new Date() ? "Overdue · " : "Target close "}
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
                  E-Sign: {deal.eSignStatus ? deal.eSignStatus.replace("_", " ") : "not started"}
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
                <Badge>
                  Ledger: {deal.ledgerStatus || "not_started"}
                </Badge>
              </div>

              <Tabs defaultValue="checklist" className="mt-5">
                <TabsList>
                  <TabsTrigger value="checklist">Checklist</TabsTrigger>
                  <TabsTrigger value="details">Deal details</TabsTrigger>
                </TabsList>

                <TabsContent value="checklist" className="mt-4">
                  {/* Progress bar showing checklist completion */}
                  {(() => {
                    const done = deal.checklist.filter((i) => i.done).length;
                    const total = deal.checklist.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                          <span>Checklist progress</span>
                          <span className="font-medium text-[var(--foreground)]">{done}/{total} complete</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct === 100 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--accent)",
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
                          onChange={(e) => {
                            void updateDealChecklistItem(
                              deal.id,
                              item.id,
                              e.target.checked,
                            ).then(() => {
                              if (e.target.checked) toast.success(`"${item.label}" marked done`);
                            });
                          }}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <span className={item.done ? "text-[var(--success)] line-through" : ""}>
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Add Custom Checklist Item */}
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const label = newItemLabel[deal.id]?.trim();
                      if (!label) return;
                      const newItem = { id: `chk_${Date.now()}`, label, done: false };
                      deal.checklist.push(newItem);
                      setNewItemLabel((prev) => ({ ...prev, [deal.id]: "" }));
                      toast.success(`Added "${label}" to checklist`);
                    }}
                  >
                    <Input
                      placeholder="Add custom compliance item…"
                      value={newItemLabel[deal.id] || ""}
                      onChange={(e) => setNewItemLabel((prev) => ({ ...prev, [deal.id]: e.target.value }))}
                      className="h-9 text-xs"
                    />
                    <Button type="submit" size="sm" variant="secondary" className="gap-1">
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </form>
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
                            toast.info(`Stage updated to "${v}"`)
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
                        E-sign
                      </label>
                      <Select
                        value={deal.eSignStatus}
                        onValueChange={(v) =>
                          void updateDealMeta(deal.id, {
                            eSignStatus: v as typeof deal.eSignStatus,
                          }).then(() => {
                            toast.info(`E-Sign status updated to "${v.replace("_", " ")}"`);
                          })
                        }
                      >
                        <SelectTrigger className="mt-1 bg-[var(--surface)]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Not started</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="signed">Signed</SelectItem>
                          <SelectItem value="voided">Voided</SelectItem>
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

                    <div>
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
        ))}
      </motion.div>

      {showNewDealModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="surface-panel w-full max-w-md rounded-[1.75rem] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Transaction Deal</h2>
              <button
                type="button"
                onClick={() => setShowNewDealModal(false)}
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
                const title = String(form.get("title"));
                const value = Number(form.get("value") || 0);
                const party1 = String(form.get("party1") || "Buyer");
                const party2 = String(form.get("party2") || "Seller");
                const targetCloseDate = String(form.get("targetCloseDate") || "");

                const newDeal: TransactionDeal = {
                  id: `deal_${Date.now()}`,
                  listingId: `lst_custom_${Date.now()}`,
                  listingTitle: title,
                  parties: [party1, party2],
                  stage: "Instruction",
                  checklist: [
                    { id: `c_${Date.now()}_1`, label: "ID & AML check complete", done: false },
                    { id: `c_${Date.now()}_2`, label: "Draft contract issued", done: false },
                    { id: `c_${Date.now()}_3`, label: "Searches & inquiries submitted", done: false },
                    { id: `c_${Date.now()}_4`, label: "Mortgage offer verified", done: false },
                  ],
                  eSignStatus: "not_started",
                  market,
                  value,
                  currency: market === "uk" ? "GBP" : "USD",
                  targetCloseDate: targetCloseDate || undefined,
                  complianceStatus: "on_track",
                  ledgerStatus: "not_started",
                  updatedAt: new Date().toISOString(),
                };
                deals.push(newDeal);
                toast.success(`Created transaction "${title}"`);
                setShowNewDealModal(false);
              }}
            >
              <Input name="title" placeholder="Property / Deal Title" required />
              <Input name="value" type="number" placeholder="Deal Value" required />
              <div className="grid grid-cols-2 gap-2">
                <Input name="party1" placeholder="Party 1 (Buyer/Tenant)" required />
                <Input name="party2" placeholder="Party 2 (Seller/Landlord)" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--muted)]">Target Close Date</label>
                <Input name="targetCloseDate" type="date" className="mt-1" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowNewDealModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Create Deal
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

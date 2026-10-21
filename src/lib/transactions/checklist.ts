import { newId } from "@/lib/data/workspace-store";
import type { Market, TransactionDeal } from "@/types";

export function defaultDealChecklist(market: Market): TransactionDeal["checklist"] {
  return market === "uk"
    ? [
        { id: newId("chk"), label: "Memorandum of sale", done: false },
        { id: newId("chk"), label: "AML checks", done: false },
        { id: newId("chk"), label: "Conveyancer instructed", done: false },
        { id: newId("chk"), label: "E-sign sale contract", done: false },
        { id: newId("chk"), label: "Client money ledger entry", done: false },
      ]
    : [
        { id: newId("chk"), label: "Purchase agreement", done: false },
        { id: newId("chk"), label: "Disclosures packet", done: false },
        { id: newId("chk"), label: "Title company opened", done: false },
        { id: newId("chk"), label: "Inspection contingency", done: false },
        { id: newId("chk"), label: "E-sign addenda", done: false },
      ];
}

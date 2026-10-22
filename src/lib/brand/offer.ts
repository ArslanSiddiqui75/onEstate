import { PLANS } from "@/lib/plans/catalog";
import type { Market, PlanId } from "@/types";

export function formatPlanPrice(market: Market, plan: PlanId) {
  if (plan === "enterprise") return "Custom";
  const item = PLANS[plan];
  const amount = market === "uk" ? item.monthlyPriceGbp : item.monthlyPriceUsd;
  return new Intl.NumberFormat(market === "uk" ? "en-GB" : "en-US", {
    style: "currency",
    currency: market === "uk" ? "GBP" : "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function regionModules(market: Market) {
  if (market === "uk") {
    return [
      { name: "Enquiries", detail: "Website, portal, and office leads on one list." },
      { name: "Diary", detail: "Viewings and valuations, including the public booking link." },
      { name: "Progression", detail: "Listed, viewing, offer, progressing, exchanged." },
      { name: "Lettings", detail: "Repairs, rent, Right to Rent, keys, and contractor cover." },
      { name: "Client links", detail: "Vendor, buyer, landlord, and tenant." },
      { name: "Payments", detail: "Subscriptions and fee requests in pounds." },
    ];
  }
  return [
    { name: "Enquiries", detail: "Website and office leads on one list." },
    { name: "Diary", detail: "Showings and valuations, including the public booking link." },
    { name: "Progression", detail: "Listed, showing, offer, progressing, closed." },
    { name: "Client links", detail: "Seller, buyer, and landlord." },
    { name: "Payments", detail: "Subscriptions and fee requests in dollars." },
  ];
}

export function planLines(market: Market, plan: PlanId) {
  if (market === "uk") {
    if (plan === "solo") {
      return ["1 user", "Enquiries and diary", "Listing drafts", "Progression checklist", "Payments in pounds"];
    }
    if (plan === "team") {
      return ["Up to 25 users", "Lead routing", "Lettings desk", "Client links", "Payments in pounds"];
    }
    return ["Unlimited offices", "Cross-office routing", "Lettings desk", "Client links", "Payments in pounds"];
  }
  if (plan === "solo") {
    return ["1 user", "Enquiries and diary", "Listing drafts", "Progression checklist", "Payments in dollars"];
  }
  if (plan === "team") {
    return ["Up to 25 users", "Lead routing", "Client links", "MLS-ready stock", "Payments in dollars"];
  }
  return ["Unlimited offices", "Cross-office routing", "Client links", "MLS-ready stock", "Payments in dollars"];
}

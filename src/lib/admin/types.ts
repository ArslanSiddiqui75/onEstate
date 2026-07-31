/**
 * Platform SaaS admin types (operator console — not brokerage RBAC).
 */
import type { Market, PlanId, Role } from "@/types";

export type PlatformAdminRole = "super_admin" | "billing_admin" | "support_admin";

export type TenantLifecycleStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled"
  | "churned";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid"
  | "paused";

export type BillingInterval = "month" | "year";

export interface PlatformAdminUser {
  id: string;
  name: string;
  email: string;
  role: PlatformAdminRole;
}

export interface TenantMemberSnapshot {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastSeenAt?: string;
  status: "active" | "invited" | "disabled";
}

export interface TenantUsageSnapshot {
  leads: number;
  contacts: number;
  listings: number;
  deals: number;
  messages: number;
  callLogs: number;
  socialPosts: number;
  openTasks: number;
}

export interface TenantSubscription {
  id: string;
  plan: PlanId;
  status: SubscriptionStatus;
  interval: BillingInterval;
  currency: "GBP" | "USD";
  unitAmount: number;
  mrr: number;
  seatsIncluded: number;
  seatsUsed: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  collectionMethod: "charge_automatically" | "send_invoice" | "manual";
  lastPaymentStatus: "paid" | "failed" | "pending" | "none";
  lastPaymentAt?: string;
  nextInvoiceAt?: string;
}

export interface TenantRecord {
  id: string;
  name: string;
  market: Market;
  brand: "certified-uk" | "certified-us";
  lifecycleStatus: TenantLifecycleStatus;
  ownerName: string;
  ownerEmail: string;
  billingEmail: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  healthScore: number;
  tags: string[];
  internalNotes: string;
  members: TenantMemberSnapshot[];
  usage: TenantUsageSnapshot;
  subscription: TenantSubscription;
  websitePublished: boolean;
  source: "signup" | "seed" | "import" | "manual";
}

export interface PlatformAuditEvent {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  entityType: "tenant" | "subscription" | "member" | "admin";
  entityId: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface PlatformRegistry {
  version: number;
  tenants: TenantRecord[];
  audit: PlatformAuditEvent[];
  updatedAt: string;
}

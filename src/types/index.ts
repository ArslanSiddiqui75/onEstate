export type Market = "uk" | "us";

export type Role =
  | "owner"
  | "broker"
  | "team_lead"
  | "agent"
  | "assistant"
  | "accountant";

export type ModuleId =
  | "crm"
  | "listings"
  | "transactions"
  | "website"
  | "social"
  | "billing";

export type AccessLevel = "full" | "edit" | "view" | "none";

export type PlanId = "solo" | "team" | "enterprise";

export type LeadType = "buyer" | "seller" | "landlord" | "tenant";

export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "viewing"
  | "offer"
  | "won"
  | "lost";

export type ListingStatus =
  | "draft"
  | "active"
  | "under_offer"
  | "sold"
  | "let"
  | "withdrawn";

export type PortalId =
  | "rightmove"
  | "zoopla"
  | "onthemarket"
  | "mls";

export type SyncStatus = "synced" | "pending" | "error" | "not_connected";
export type Priority = "low" | "medium" | "high" | "urgent";
export type ContactSource =
  | "website"
  | "portal"
  | "mls"
  | "telephony"
  | "sms"
  | "import"
  | "manual"
  | "referral";
export type ConsentStatus = "unknown" | "opted_in" | "opted_out";
export type VerificationStatus = "unverified" | "valid" | "invalid";

export interface PhoneContactMethod {
  id: string;
  label: string;
  number: string;
  source: ContactSource;
  consent: ConsentStatus;
  verification: VerificationStatus;
  preferred?: boolean;
  lastContactedAt?: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  phones?: PhoneContactMethod[];
  type: LeadType;
  stage: LeadStage;
  score: number;
  assignedTo: string;
  market: Market;
  source: string;
  budget?: number;
  notes?: string;
  nextAction?: string;
  nextActionDueAt?: string;
  territory?: string;
  priority?: Priority;
  createdAt: string;
  updatedAt: string;
}

export type ContactCategory =
  | "lead"
  | "client"
  | "past_client"
  | "vendor"
  | "partner"
  | "other";

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  phones?: PhoneContactMethod[];
  company?: string;
  category: ContactCategory;
  tags: string[];
  notes?: string;
  leadId?: string;
  assignedTo?: string;
  market: Market;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Listing {
  id: string;
  title: string;
  address: string;
  city: string;
  market: Market;
  status: ListingStatus;
  price: number;
  currency: "GBP" | "USD";
  beds: number;
  baths: number;
  sqft: number;
  tenure?: "freehold" | "leasehold";
  mlsDisclosureComplete?: boolean;
  agentId: string;
  portals: { portal: PortalId; status: SyncStatus }[];
  imageUrl: string;
  description: string;
  complianceIssues?: string[];
  syncReadiness?: number;
  lastSyncAt?: string;
  nextMilestone?: string;
  createdAt: string;
}

export interface TransactionDeal {
  id: string;
  listingId: string;
  listingTitle: string;
  parties: string[];
  stage: string;
  checklist: { id: string; label: string; done: boolean }[];
  eSignStatus: "not_started" | "sent" | "signed" | "voided";
  market: Market;
  value: number;
  currency: "GBP" | "USD";
  coordinator?: string;
  targetCloseDate?: string;
  riskLevel?: Priority;
  ledgerStatus?: "not_started" | "in_progress" | "reconciled";
  complianceStatus?: "on_track" | "attention" | "blocked";
  notes?: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarInitials: string;
}

export interface DemoSession {
  market: Market;
  role: Role;
  plan: PlanId;
  orgName: string;
  userName: string;
}


export type IntegrationCategory =
  | "portal"
  | "mls"
  | "esign"
  | "accounting"
  | "compliance";

export type IntegrationProviderId =
  | "rightmove"
  | "zoopla"
  | "onthemarket"
  | "mls"
  | "docusign"
  | "dropbox-sign"
  | "xero"
  | "quickbooks"
  | "audit-hub";

export type IntegrationHealth =
  | "connected"
  | "attention"
  | "disconnected"
  | "planned";

export type MessageDirection = "inbound" | "outbound" | "system";
export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "received";

export interface ConversationMessage {
  id: string;
  orgId: string;
  threadId: string;
  leadId: string;
  direction: MessageDirection;
  body: string;
  status: MessageStatus;
  providerSid?: string;
  sentAt: string;
}

export interface ConversationThread {
  id: string;
  orgId: string;
  leadId: string;
  phoneNumber: string;
  lastMessageAt?: string;
}

export interface CallLog {
  id: string;
  orgId: string;
  leadId?: string;
  direction: "inbound" | "outbound";
  phoneNumber: string;
  outcome: "connected" | "voicemail" | "no_answer" | "logged";
  notes?: string;
  durationSeconds?: number;
  createdAt: string;
}

export interface MessageSequence {
  id: string;
  orgId: string;
  title: string;
  description: string;
  status: "draft" | "active" | "paused";
  steps: string[];
  createdAt: string;
}

export type AutomationTrigger =
  | "lead_created"
  | "stage_changed"
  | "lead_contacted"
  | "no_reply"
  | "manual";

export type AutomationActionType =
  | "send_sms"
  | "create_task"
  | "wait"
  | "update_stage"
  | "notify_owner"
  | "add_tag";

export interface AutomationStep {
  id: string;
  type: AutomationActionType;
  label: string;
  config: {
    body?: string;
    delayHours?: number;
    stage?: LeadStage;
    taskTitle?: string;
    channel?: "SMS" | "Call" | "Email";
    tag?: string;
  };
}

export interface Automation {
  id: string;
  orgId: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  triggerStage?: LeadStage;
  status: "draft" | "active" | "paused";
  steps: AutomationStep[];
  createdAt: string;
  updatedAt: string;
}

export interface SequenceEnrollment {
  id: string;
  orgId: string;
  sequenceId: string;
  leadId: string;
  status: "active" | "paused" | "completed";
  followUp: boolean;
  nurture: boolean;
}

export interface LeadTask {
  id: string;
  leadId: string;
  orgId: string;
  title: string;
  dueAt?: string;
  channel: "SMS" | "Call" | "Email";
  status: "open" | "done";
}

export interface WebsiteSite {
  id: string;
  orgId: string;
  headline: string;
  tagline: string;
  primaryCta: string;
  phone: string;
  email: string;
  published: boolean;
  updatedAt: string;
  customDomain?: string;
  themeColor?: string;
  showHero?: boolean;
  showListings?: boolean;
  showClientPortal?: boolean;
  showContactForm?: boolean;
  showAgentBio?: boolean;
  aboutBio?: string;
}

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "x";

export type SocialAccountStatus = "connected" | "disconnected" | "expired";

export interface SocialAccount {
  id: string;
  orgId: string;
  platform: SocialPlatform;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  /** Platform-side id (Page id, IG user id, LinkedIn URN subject, X user id) */
  externalAccountId?: string;
  status: SocialAccountStatus;
  scopes?: string[];
  connectedAt?: string;
  /** Last publish/token error surfaced from the platform, for the Accounts UI */
  lastError?: string;
}

export interface SocialMediaItem {
  id: string;
  kind: "image" | "video";
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** Data URL for uploads, or https URL for seeded/demo assets */
  dataUrl: string;
  createdAt: string;
}

export interface SocialPost {
  id: string;
  orgId: string;
  /** Connected accounts this post targets */
  accountIds: string[];
  caption: string;
  media: SocialMediaItem[];
  linkUrl?: string;
  /** Optional listing used to draft copy / pull a cover image */
  listingId?: string;
  status: "draft" | "scheduled" | "published" | "failed";
  scheduledFor?: string;
  publishedAt?: string;
  /** Publish failure detail, surfaced in the queue when status is "failed" */
  lastError?: string;
  createdAt: string;
  /** @deprecated Legacy single-channel field; prefer accountIds */
  channel?: SocialPlatform;
}

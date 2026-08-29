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

/** Per-org portal feed credentials (branch/network). Live APIs need partner access. */
export interface PortalConnection {
  portal: PortalId;
  connected: boolean;
  /** Branch / office id issued by the portal network */
  branchId?: string;
  /** Network / group id when the portal requires it */
  networkId?: string;
  /** True when the user saved an API/feed key (value stored locally, not in DB) */
  apiKeyConfigured?: boolean;
  connectedAt?: string;
  lastVerifiedAt?: string;
  notes?: string;
}

export interface ListingPortalSync {
  portal: PortalId;
  status: SyncStatus;
  lastError?: string;
  lastMessage?: string;
  lastSyncedAt?: string;
}
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
  /** Written by automation `add_tag` steps */
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/** Fields a CRM user can patch. Score is recomputed on save, not typed. */
export type LeadPatch = Partial<
  Omit<Lead, "id" | "createdAt" | "updatedAt" | "market">
>;

export type LeadRoutingMode = "creator" | "round_robin" | "territory" | "least_open";

export interface LeadRoutingSettings {
  mode: LeadRoutingMode;
  /** Roles that receive auto-assigned leads (owner is a separate toggle). */
  includeRoles: Role[];
  includeOwner: boolean;
  /** memberId → territory tokens (city, postcode area, office name) */
  territories: Record<string, string[]>;
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
  portals: ListingPortalSync[];
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
export type MessageChannel = "sms" | "email";

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
  channel?: MessageChannel;
  subject?: string;
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

export type SequenceKind = "follow_up" | "nurture" | "custom";

export type SequenceStepType = "sms" | "email" | "task";

export interface SequenceStep {
  id: string;
  type: SequenceStepType;
  label: string;
  body?: string;
  subject?: string;
  channel?: "SMS" | "Call" | "Email";
}

export interface MessageSequence {
  id: string;
  orgId: string;
  title: string;
  description: string;
  status: "draft" | "active" | "paused";
  kind: SequenceKind;
  steps: SequenceStep[];
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
  | "send_email"
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
    subject?: string;
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

export type AutomationRunStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface AutomationRunStep {
  id: string;
  stepIndex: number;
  stepType: AutomationActionType | string;
  label?: string;
  status: "completed" | "failed" | "skipped" | "waiting";
  detail?: string;
  executedAt: string;
}

export interface AutomationRun {
  id: string;
  orgId: string;
  automationId: string;
  leadId: string;
  trigger: AutomationTrigger;
  status: AutomationRunStatus;
  stepIndex: number;
  /** When a parked `wait` step becomes due */
  runAfter: string;
  lastError?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  steps?: AutomationRunStep[];
}

export interface LeadActivity {
  id: string;
  orgId: string;
  leadId: string;
  actorId?: string;
  activityType: string;
  body?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SequenceEnrollment {
  id: string;
  orgId: string;
  sequenceId: string;
  leadId: string;
  status: "active" | "paused" | "completed";
  followUp: boolean;
  nurture: boolean;
  currentStep: number;
  lastRanAt?: string;
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

export type DomainStatus = "none" | "pending" | "verifying" | "connected" | "failed";
export type SslStatus = "none" | "provisioning" | "active" | "error";

export type WebsiteTemplateId =
  | "modern-minimal"
  | "luxury-dark"
  | "classic-agency"
  | "bold-vibrant"
  | "coastal-living"
  | "urban-edge"
  | "heritage-estate"
  | "tech-forward";

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
  /** Public path segment: /site/<slug> */
  slug?: string;
  customDomain?: string;
  themeColor?: string;
  showHero?: boolean;
  showListings?: boolean;
  showClientPortal?: boolean;
  showContactForm?: boolean;
  showAgentBio?: boolean;
  aboutBio?: string;
  aboutHeading?: string;
  listingsHeading?: string;
  contactHeading?: string;
  secondaryCta?: string;
  footerNote?: string;
  /** Full-bleed hero photo (https URL or uploaded storage URL) */
  heroImageUrl?: string;
  /** Selected website template/theme */
  templateId?: WebsiteTemplateId;
  /** Domain connection status */
  domainStatus?: DomainStatus;
  /** When the domain was verified */
  domainVerifiedAt?: string;
  /** SSL certificate status */
  sslStatus?: SslStatus;
  /**
   * Ordered page blocks. Missing on older payloads — hydrate from the
   * `show*` flags. Footer is always last and is not in this list.
   */
  sections?: WebsiteSectionConfig[];
  testimonialsHeading?: string;
  testimonials?: WebsiteQuote[];
  statsHeading?: string;
  stats?: WebsiteStat[];
  ctaHeading?: string;
  ctaBody?: string;
}

export type WebsiteSectionKind =
  | "hero"
  | "listings"
  | "about"
  | "testimonials"
  | "stats"
  | "cta"
  | "contact";

export interface WebsiteSectionConfig {
  kind: WebsiteSectionKind;
  visible: boolean;
  /** Style variant id from the section catalog. Empty = follow the theme. */
  variant?: string;
}

export interface WebsiteQuote {
  quote: string;
  name: string;
  role?: string;
}

export interface WebsiteStat {
  value: string;
  label: string;
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

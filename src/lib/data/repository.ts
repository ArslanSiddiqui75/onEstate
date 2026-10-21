import type {
  Automation,
  AutomationRun,
  CallLog,
  Contact,
  ConversationMessage,
  Lead,
  LeadActivity,
  LeadPatch,
  LeadStage,
  LeadTask,
  LeadRoutingSettings,
  Listing,
  ListingPatch,
  ListingStatus,
  Market,
  MessageSequence,
  OrgMember,
  PlanId,
  Role,
  SequenceEnrollment,
  SocialAccount,
  SocialPost,
  TransactionDeal,
  WebsiteSite,
} from "@/types";
import type {
  WorkspaceOrg,
  WorkspaceSnapshot,
  WorkspaceUser,
} from "@/lib/data/workspace-store";

export interface WorkspaceRepository {
  mode: "local" | "supabase";
  getSnapshot(): Promise<WorkspaceSnapshot | null>;
  saveAuth(user: WorkspaceUser, org: WorkspaceOrg): Promise<void>;
  clearAuth(): Promise<void>;
  setPlan(plan: PlanId): Promise<WorkspaceOrg>;
  updateOrganization(patch: {
    name?: string;
    market?: Market;
    onboardingCompleted?: boolean;
  }): Promise<WorkspaceOrg>;
  updateProfile(patch: { name: string }): Promise<WorkspaceUser>;
  saveLeadRouting(settings: LeadRoutingSettings): Promise<WorkspaceOrg>;
  listMembers(): Promise<OrgMember[]>;
  inviteMember(input: {
    name: string;
    email: string;
    role: Role;
  }): Promise<OrgMember>;
  listLeads(): Promise<Lead[]>;
  createLead(lead: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead>;
  updateLeadStage(id: string, stage: LeadStage): Promise<Lead>;
  updateLead(id: string, patch: LeadPatch): Promise<Lead>;
  archiveLead(id: string): Promise<void>;
  listContacts(): Promise<Contact[]>;
  createContact(
    contact: Omit<Contact, "id" | "createdAt" | "updatedAt">,
  ): Promise<Contact>;
  updateContact(
    id: string,
    patch: Partial<
      Pick<
        Contact,
        | "name"
        | "email"
        | "phone"
        | "phones"
        | "company"
        | "category"
        | "tags"
        | "notes"
        | "leadId"
        | "assignedTo"
        | "lastContactedAt"
      >
    >,
  ): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  listListings(): Promise<Listing[]>;
  createListing(
    listing: Omit<Listing, "id" | "createdAt"> & {
      id?: string;
      createdAt?: string;
    },
  ): Promise<Listing>;
  updateListingStatus(id: string, status: ListingStatus): Promise<Listing>;
  updateListing(id: string, patch: ListingPatch): Promise<Listing>;
  archiveListing(id: string): Promise<void>;
  listDeals(): Promise<TransactionDeal[]>;
  createDeal(
    deal: Omit<TransactionDeal, "id" | "updatedAt"> & { id?: string },
  ): Promise<TransactionDeal>;
  updateDealChecklistItem(
    dealId: string,
    checklistId: string,
    done: boolean,
  ): Promise<TransactionDeal>;
  addDealChecklistItem(
    dealId: string,
    label: string,
  ): Promise<TransactionDeal>;
  updateDealMeta(
    dealId: string,
    patch: Partial<
      Pick<
        TransactionDeal,
        "stage" | "eSignStatus" | "ledgerStatus" | "complianceStatus" | "notes"
      >
    >,
  ): Promise<TransactionDeal>;
  archiveDeal(dealId: string): Promise<void>;
  listMessages(leadId: string): Promise<ConversationMessage[]>;
  appendMessage(
    message: Omit<ConversationMessage, "id"> & { id?: string },
  ): Promise<ConversationMessage>;
  listCallLogs(leadId?: string): Promise<CallLog[]>;
  logCall(
    input: Omit<CallLog, "id" | "createdAt"> & { id?: string },
  ): Promise<CallLog>;
  listSequences(): Promise<MessageSequence[]>;
  listAutomations(): Promise<Automation[]>;
  createAutomation(
    automation: Omit<Automation, "id" | "createdAt" | "updatedAt">,
  ): Promise<Automation>;
  updateAutomation(
    id: string,
    patch: Partial<
      Pick<
        Automation,
        | "name"
        | "description"
        | "trigger"
        | "triggerStage"
        | "status"
        | "steps"
      >
    >,
  ): Promise<Automation>;
  deleteAutomation(id: string): Promise<void>;
  listAutomationRuns(leadId?: string): Promise<AutomationRun[]>;
  listLeadActivities(leadId: string): Promise<LeadActivity[]>;
  listEnrollments(leadId?: string): Promise<SequenceEnrollment[]>;
  upsertEnrollment(
    input: Omit<SequenceEnrollment, "id"> & { id?: string },
  ): Promise<SequenceEnrollment>;
  createLeadTask(
    input: Omit<LeadTask, "id"> & { id?: string },
  ): Promise<LeadTask>;
  resolveTask(taskId: string): Promise<void>;
  listOpenTasks(): Promise<WorkspaceSnapshot["tasks"]>;
  listTasks(): Promise<WorkspaceSnapshot["tasks"]>;
  getWebsite(): Promise<WebsiteSite | null>;
  saveWebsite(site: WebsiteSite): Promise<WebsiteSite>;
  listSocialAccounts(): Promise<SocialAccount[]>;
  upsertSocialAccount(
    account: Omit<SocialAccount, "id"> & { id?: string },
  ): Promise<SocialAccount>;
  deleteSocialAccount(id: string): Promise<void>;
  listSocialPosts(): Promise<SocialPost[]>;
  createSocialPost(
    post: Omit<SocialPost, "id" | "createdAt"> & { id?: string },
  ): Promise<SocialPost>;
  updateSocialPost(
    id: string,
    patch: Partial<
      Pick<
        SocialPost,
        | "caption"
        | "status"
        | "scheduledFor"
        | "publishedAt"
        | "accountIds"
        | "media"
        | "linkUrl"
        | "listingId"
        | "lastError"
      >
    >,
  ): Promise<SocialPost>;
  deleteSocialPost(id: string): Promise<void>;
}

import { describe, expect, it } from "vitest";
import { buildNotices, type NoticeFeedInput } from "@/lib/notices/feed";
import type { CallLog, ConversationMessage, Lead, LeadTask, Listing, SocialPost, TransactionDeal } from "@/types";

const now = new Date("2026-10-27T12:00:00.000Z");

function lead(patch: Partial<Lead> & Pick<Lead, "id" | "name">): Lead {
  return {
    email: "",
    phone: "",
    type: "buyer",
    stage: "contacted",
    score: 10,
    assignedTo: "owner",
    market: "uk",
    source: "website",
    createdAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-20T09:00:00.000Z",
    ...patch,
  };
}

function base(patch: Partial<NoticeFeedInput> = {}): NoticeFeedInput {
  return {
    now,
    market: "uk",
    diaryLabel: "Diary",
    access: { crm: true, listings: true, transactions: true, social: true },
    leads: [],
    messages: [],
    callLogs: [],
    tasks: [],
    listings: [],
    deals: [],
    socialAccounts: [],
    socialPosts: [],
    appointments: [],
    offers: [],
    fees: [],
    lettings: null,
    tickets: [],
    ...patch,
  };
}

describe("buildNotices", () => {
  it("keeps an inbound conversation and a missed call, and skips a thread that was answered", () => {
    const leads = [lead({ id: "l1", name: "Sam Okonkwo" }), lead({ id: "l2", name: "Helen Croft" })];
    const messages: ConversationMessage[] = [
      {
        id: "m1",
        orgId: "org",
        threadId: "t1",
        leadId: "l1",
        direction: "inbound",
        body: "Is Saturday still free for a viewing?",
        status: "received",
        sentAt: "2026-10-27T08:00:00.000Z",
        channel: "sms",
      },
      {
        id: "m2",
        orgId: "org",
        threadId: "t2",
        leadId: "l2",
        direction: "inbound",
        body: "Thanks, that works.",
        status: "received",
        sentAt: "2026-10-26T08:00:00.000Z",
        channel: "email",
      },
      {
        id: "m3",
        orgId: "org",
        threadId: "t2",
        leadId: "l2",
        direction: "outbound",
        body: "See you then.",
        status: "sent",
        sentAt: "2026-10-26T09:00:00.000Z",
        channel: "email",
      },
    ];
    const callLogs: CallLog[] = [
      {
        id: "c1",
        orgId: "org",
        leadId: "l1",
        direction: "inbound",
        phoneNumber: "+447700900123",
        outcome: "no_answer",
        createdAt: "2026-10-27T07:00:00.000Z",
      },
      {
        id: "c2",
        orgId: "org",
        leadId: "l2",
        direction: "inbound",
        phoneNumber: "+447700900124",
        outcome: "connected",
        createdAt: "2026-10-27T07:30:00.000Z",
      },
    ];
    const notices = buildNotices(base({ leads, messages, callLogs }));
    expect(notices.map((notice) => notice.kind)).toEqual(["call", "conversation"]);
    expect(notices[1]).toMatchObject({
      title: "Sam Okonkwo",
      href: "/app/conversations?lead=l1",
      detail: "Text waiting · Is Saturday still free for a viewing?",
    });
    expect(notices[0].tone).toBe("danger");
  });

  it("shows a new enquiry unless that person is already waiting in a conversation", () => {
    const leads = [
      lead({ id: "l1", name: "Sam Okonkwo", stage: "new" }),
      lead({ id: "l2", name: "Priya Shah", stage: "new", type: "tenant", source: "portal" }),
    ];
    const messages: ConversationMessage[] = [
      {
        id: "m1",
        orgId: "org",
        threadId: "t1",
        leadId: "l1",
        direction: "inbound",
        body: "Hello",
        status: "received",
        sentAt: "2026-10-27T08:00:00.000Z",
      },
    ];
    const notices = buildNotices(base({ leads, messages }));
    expect(notices.map((notice) => `${notice.kind}:${notice.title}`)).toEqual([
      "conversation:Sam Okonkwo",
      "enquiry:Priya Shah",
    ]);
    expect(notices[1].detail).toBe("New tenant enquiry · portal");
  });

  it("marks overdue tasks and hides them without CRM access", () => {
    const tasks: LeadTask[] = [
      { id: "task1", leadId: "l1", orgId: "org", title: "Call back", dueAt: "2026-10-01", channel: "Call", status: "open" },
      { id: "task2", leadId: "l1", orgId: "org", title: "Done", dueAt: "2026-10-01", channel: "Call", status: "done" },
    ];
    const open = buildNotices(base({ leads: [lead({ id: "l1", name: "Sam Okonkwo" })], tasks }));
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ tone: "danger", taskId: "task1", detail: "Sam Okonkwo · Overdue" });
    const locked = buildNotices(
      base({
        leads: [lead({ id: "l1", name: "Sam Okonkwo" })],
        tasks,
        access: { crm: false, listings: true, transactions: true, social: true },
      }),
    );
    expect(locked).toHaveLength(0);
  });

  it("includes diary requests, offers, deals, portal failures, and support waiting on the office", () => {
    const listings: Listing[] = [
      {
        id: "lst",
        title: "14 Elm Grove",
        address: "14 Elm Grove",
        city: "Bristol",
        market: "uk",
        status: "active",
        price: 400000,
        currency: "GBP",
        beds: 3,
        baths: 1,
        sqft: 900,
        agentId: "owner",
        portals: [{ portal: "rightmove", status: "error" }],
        imageUrl: "",
        description: "",
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ];
    const deals: TransactionDeal[] = [
      {
        id: "deal1",
        listingId: "lst",
        listingTitle: "14 Elm Grove",
        parties: [],
        stage: "offer",
        checklist: [],
        eSignStatus: "sent",
        market: "uk",
        value: 400000,
        currency: "GBP",
        complianceStatus: "blocked",
        updatedAt: "2026-10-26T00:00:00.000Z",
      },
    ];
    const notices = buildNotices(
      base({
        listings,
        deals,
        appointments: [
          {
            id: "apt",
            kind: "valuation",
            status: "requested",
            at: "2026-10-28T10:00:00.000Z",
            clientName: "Helen Croft",
            address: "Flat 2, Quay Walk",
            bookToken: "harbour",
          },
        ],
        offers: [
          {
            id: "off",
            address: "8 Harbour Street",
            buyerName: "Sam Okonkwo",
            amount: 425000,
            currency: "GBP",
            status: "submitted",
            at: "2026-10-21T16:00:00.000Z",
          },
        ],
        tickets: [
          {
            id: "tkt",
            subject: "Portal login loop",
            status: "pending",
            priority: "high",
            updatedAt: "2026-10-27T09:00:00.000Z",
          },
          {
            id: "done",
            subject: "Closed ticket",
            status: "resolved",
            priority: "low",
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const kinds = notices.map((notice) => notice.kind);
    expect(kinds).toContain("diary");
    expect(kinds).toContain("offer");
    expect(kinds).toContain("deal");
    expect(kinds).toContain("listing");
    expect(kinds).toContain("support");
    expect(kinds).not.toContain("enquiry");
    expect(notices.find((notice) => notice.kind === "deal")?.detail).toBe("Compliance is blocked");
    expect(notices.find((notice) => notice.kind === "listing")?.detail).toBe("Rightmove needs a retry");
    expect(notices.find((notice) => notice.kind === "support")).toMatchObject({
      tone: "danger",
      href: "/app/settings/support/tkt",
    });
  });

  it("adds open lettings in the UK and leaves them off a US book", () => {
    const lettings = {
      version: 1 as const,
      properties: [
        {
          id: "p1",
          address: "8 Harbour Lane",
          city: "Bristol",
          postcode: "BS8",
          jurisdiction: "england" as const,
          hmo: false,
          reportToken: "harbour",
          rooms: [
            {
              id: "r1",
              name: "Room 4",
              tenantName: "Jordan Hale",
              rentPcm: 450,
              marketRentPcm: 620,
              rentStatus: "late" as const,
              depositProtected: true,
            },
          ],
        },
      ],
      repairs: [
        {
          id: "rep",
          reference: "R-1",
          propertyId: "p1",
          roomId: "r1",
          title: "I can smell gas",
          body: "Gas",
          category: "heating" as const,
          urgency: "emergency" as const,
          emergency: "gas" as const,
          status: "acknowledged" as const,
          replyBy: "2026-10-27T00:00:00.000Z",
          fixBy: "2026-10-27T04:00:00.000Z",
          createdAt: "2026-10-27T00:00:00.000Z",
          channel: "text" as const,
          events: [],
          photos: [],
        },
      ],
      compliance: [
        {
          id: "cert",
          propertyId: "p1",
          kind: "gas_safety" as const,
          title: "Gas safety",
          dueAt: "2026-09-01",
          status: "overdue" as const,
          detail: "Past its date",
        },
      ],
      inspections: [],
      contractors: [],
      keys: [],
    };
    const uk = buildNotices(base({ lettings }));
    expect(uk.filter((notice) => notice.kind === "letting").map((notice) => notice.title).sort()).toEqual([
      "Gas safety",
      "I can smell gas",
      "Jordan Hale",
    ]);
    const us = buildNotices(base({ market: "us", diaryLabel: "Calendar", lettings }));
    expect(us.some((notice) => notice.kind === "letting")).toBe(false);
  });

  it("surfaces a failed social post", () => {
    const socialPosts: SocialPost[] = [
      {
        id: "post",
        orgId: "org",
        accountIds: ["acc"],
        caption: "Just listed on the harbour",
        media: [],
        status: "failed",
        lastError: "Instagram rejected the image",
        createdAt: "2026-10-27T06:00:00.000Z",
      },
    ];
    const notices = buildNotices(base({ socialPosts }));
    expect(notices[0]).toMatchObject({
      kind: "social",
      tone: "danger",
      href: "/app/social",
      detail: "Instagram rejected the image",
    });
  });
});

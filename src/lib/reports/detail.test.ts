import { describe, expect, it } from "vitest";
import { buildWorkspaceReport, reportToCsv, type WorkspaceReportInput } from "@/lib/reports/detail";
import type { Lead, LeadTask, OrgMember } from "@/types";

const now = Date.parse("2026-10-27T12:00:00.000Z");

function lead(patch: Partial<Lead> & Pick<Lead, "id" | "name" | "createdAt">): Lead {
  return {
    email: "",
    phone: "",
    type: "buyer",
    stage: "new",
    score: 10,
    assignedTo: "dev_owner",
    market: "uk",
    source: "website",
    updatedAt: patch.createdAt,
    ...patch,
  };
}

function member(id: string, name: string, role: OrgMember["role"]): OrgMember {
  return { id, name, email: `${id}@certified.local`, role, avatarInitials: "AN" };
}

function base(patch: Partial<WorkspaceReportInput> = {}): WorkspaceReportInput {
  return {
    range: "all",
    market: "uk",
    now,
    orgName: "Northbridge Realty Group",
    members: [member("dev_owner", "Ava North", "owner")],
    leads: [],
    contacts: [],
    listings: [],
    deals: [],
    messages: [],
    callLogs: [],
    sequences: [],
    automations: [],
    enrollments: [],
    tasks: [],
    website: null,
    socialAccounts: [],
    socialPosts: [],
    portals: [],
    agency: {
      version: 1,
      bookingToken: "harbour",
      appointments: [
        {
          id: "apt_elm",
          kind: "viewing",
          status: "confirmed",
          at: "2026-10-22T14:00:00.000Z",
          clientName: "Sam Okonkwo",
          address: "14 Elm Grove",
          bookToken: "elm-grove",
          notes: 'Said "hello"',
        },
      ],
      offers: [],
      portals: [],
      fees: [
        {
          id: "fee_old",
          address: "14 Elm Grove",
          label: "Sales fee",
          amount: 4500,
          currency: "GBP",
          status: "requested",
          at: "2026-10-01T09:00:00.000Z",
        },
      ],
      referrals: [],
    },
    lettings: {
      version: 1,
      properties: [
        {
          id: "p_oak",
          address: "12 Oak Road",
          city: "Bristol",
          postcode: "BS1 4DJ",
          jurisdiction: "england",
          hmo: false,
          reportToken: "oak-road",
          tenancyStage: "active",
          rooms: [
            {
              id: "r1",
              name: "Flat 2",
              tenantName: "Priya Shah",
              rentPcm: 1250,
              marketRentPcm: 1400,
              rentStatus: "late",
              depositProtected: true,
              rightToRent: "clear",
            },
          ],
        },
      ],
      repairs: [
        {
          id: "rep_old",
          reference: "R-OLD",
          propertyId: "p_oak",
          roomId: "r1",
          title: "Old drip",
          body: "Started last month.",
          category: "plumbing",
          urgency: "routine",
          emergency: null,
          status: "reported",
          replyBy: "2026-10-02T00:00:00.000Z",
          fixBy: "2026-10-12T00:00:00.000Z",
          createdAt: "2026-10-01T09:00:00.000Z",
          channel: "text",
          events: [],
          photos: [],
        },
        {
          id: "rep_new",
          reference: "R-NEW",
          propertyId: "p_oak",
          roomId: "r1",
          title: "New drip",
          body: "Started this week.",
          category: "plumbing",
          urgency: "urgent",
          emergency: null,
          status: "reported",
          replyBy: "2026-10-26T00:00:00.000Z",
          fixBy: "2026-11-02T00:00:00.000Z",
          createdAt: "2026-10-25T09:00:00.000Z",
          channel: "link",
          events: [],
          photos: [],
        },
      ],
      compliance: [
        {
          id: "c1",
          propertyId: "p_oak",
          kind: "gas_safety",
          title: "Gas safety",
          dueAt: "2026-09-01T00:00:00.000Z",
          status: "overdue",
          detail: "Certificate lapsed.",
        },
        {
          id: "c2",
          propertyId: "p_oak",
          kind: "epc",
          title: "EPC far ahead",
          dueAt: "2031-06-01T00:00:00.000Z",
          status: "ok",
          detail: "Valid for years.",
        },
        {
          id: "c3",
          propertyId: "p_oak",
          kind: "alarms",
          title: "Alarm check",
          dueAt: "2026-11-12T00:00:00.000Z",
          status: "due",
          detail: "Due next month.",
        },
      ],
      inspections: [],
      contractors: [],
      keys: [],
    },
    ...patch,
  };
}

describe("workspace report", () => {
  it("keeps a recent opportunity and drops an older one on a 7 day range", () => {
    const report = buildWorkspaceReport(
      base({
        range: "7d",
        leads: [
          lead({
            id: "old",
            name: "Old Enquiry",
            createdAt: "2026-10-01T00:00:00.000Z",
            source: "portal",
          }),
          lead({
            id: "new",
            name: "Priya Shah",
            createdAt: "2026-10-25T10:00:00.000Z",
            stage: "contacted",
            source: "website",
            budget: 420000,
            nextAction: "Call about the keys",
            listingId: "lst_elm",
          }),
        ],
        listings: [
          {
            id: "lst_elm",
            title: "14 Elm Grove",
            address: "14 Elm Grove",
            city: "Bristol",
            market: "uk",
            status: "active",
            price: 500000,
            currency: "GBP",
            beds: 3,
            baths: 1,
            sqft: 900,
            agentId: "dev_owner",
            portals: [],
            imageUrl: "",
            description: "",
            createdAt: "2026-10-25T00:00:00.000Z",
          },
        ],
      }),
    );

    const opportunities = report.sections.find((section) => section.id === "opportunities");
    expect(opportunities?.groups[0].records.map((record) => record.title)).toEqual(["Priya Shah"]);
    expect(opportunities?.groups[0].records[0].detail).toContain("£420,000");
    expect(opportunities?.groups[0].records[0].detail).toContain("14 Elm Grove");
    expect(opportunities?.groups[0].records[0].note).toContain("Call about the keys");
    expect(report.overview[0]).toMatchObject({ label: "Opportunities", value: "1" });

    const repairs = report.sections.find((section) => section.id === "lettings")?.groups.find((group) => group.title === "Repairs");
    expect(repairs?.records.map((record) => record.title)).toEqual(["R-NEW · New drip"]);
    const certificates = report.sections
      .find((section) => section.id === "lettings")
      ?.groups.find((group) => group.title === "Certificates");
    expect(certificates?.records.map((record) => record.title)).toEqual(["Gas safety"]);
    const month = buildWorkspaceReport(
      base({
        range: "30d",
        leads: [],
      }),
    );
    expect(
      month.sections
        .find((section) => section.id === "lettings")
        ?.groups.find((group) => group.title === "Certificates")
        ?.records.map((record) => record.title),
    ).toEqual(["Gas safety", "Alarm check"]);

    const fees = report.sections.find((section) => section.id === "diary")?.groups.find((group) => group.title === "Fees");
    expect(fees?.records).toEqual([]);
    const appointments = report.sections
      .find((section) => section.id === "diary")
      ?.groups.find((group) => group.title === "Appointments");
    expect(appointments?.records[0].title).toContain("Sam Okonkwo");
  });

  it("exports the same names the report shows, and quotes notes", () => {
    const task: LeadTask = {
      id: "task_1",
      leadId: "new",
      orgId: "org",
      title: "Call Priya",
      dueAt: "2026-10-01",
      channel: "Call",
      status: "open",
    };
    const report = buildWorkspaceReport(
      base({
        leads: [lead({ id: "new", name: "Priya Shah", createdAt: "2026-10-25T10:00:00.000Z" })],
        tasks: [task],
      }),
    );
    const tasks = report.sections.find((section) => section.id === "tasks");
    expect(tasks?.groups[0].records[0].detail).toContain("Overdue");
    const csv = reportToCsv(report);
    expect(csv).toContain("Priya Shah");
    expect(csv).toContain('Said ""hello""');
    expect(csv).toContain("Call Priya");
  });

  it("leaves lettings off a US book and names the calendar", () => {
    const report = buildWorkspaceReport(base({ market: "us", lettings: null }));
    expect(report.headline).toContain("US book");
    expect(report.sections.some((section) => section.id === "lettings")).toBe(false);
    expect(report.sections.some((section) => section.id === "calendar")).toBe(true);
    expect(report.overview.map((item) => item.label)).toContain("Calls");
  });

  it("counts only open opportunities and unsold stock in the headline figures", () => {
    const listing = (id: string, status: "active" | "sold" | "draft", price: number) =>
      ({
        id,
        title: id,
        address: id,
        city: "Leeds",
        market: "uk",
        status,
        price,
        currency: "GBP",
        beds: 1,
        baths: 1,
        sqft: 1,
        agentId: "dev_owner",
        portals: [],
        createdAt: "2026-10-20T10:00:00.000Z",
      }) as unknown as WorkspaceReportInput["listings"][number];
    const report = buildWorkspaceReport(
      base({
        leads: [
          lead({ id: "a", name: "A", createdAt: "2026-10-20T10:00:00.000Z", budget: 100 }),
          lead({ id: "b", name: "B", createdAt: "2026-10-20T10:00:00.000Z", budget: 900, stage: "won" }),
          lead({ id: "c", name: "C", createdAt: "2026-10-20T10:00:00.000Z", budget: 900, stage: "lost" }),
        ],
        listings: [listing("on", "active", 200_000), listing("done", "sold", 300_000), listing("d", "draft", 50_000)],
      }),
    );
    const opp = report.overview.find((item) => item.label === "Opportunities");
    expect(opp?.value).toBe("1");
    expect(opp?.hint).toContain("100");
    expect(opp?.hint).not.toContain("1,000");
    const listings = report.overview.find((item) => item.label === "Listings");
    expect(listings?.hint).toContain("200,000");
    expect(listings?.hint).not.toContain("550,000");
  });
});

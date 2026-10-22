import { describe, expect, it } from "vitest";
import {
  acknowledgeRepair,
  addRepair,
  applyInbox,
  bookTradesperson,
  buildDisputePack,
  createRepair,
  emptyInbox,
  markFixed,
  rentSummary,
  seedBook,
  tryConfirmRepair,
} from "@/lib/lettings/book";
import { gbp, marketPosition } from "@/lib/lettings/format";
import { triageReport } from "@/lib/lettings/triage";

const NOW = new Date("2026-10-21T12:00:00.000Z");

describe("repair triage", () => {
  it("treats a dripping tap as routine plumbing with a 3 day reply clock", () => {
    const result = triageReport("The kitchen tap keeps dripping. It's worse overnight.", NOW);
    expect(result.category).toBe("plumbing");
    expect(result.urgency).toBe("routine");
    expect(result.emergency).toBeNull();
    expect(result.replyBy).toBe(new Date(NOW.getTime() + 3 * 86_400_000).toISOString());
    expect(result.fixBy).toBe(new Date(NOW.getTime() + 14 * 86_400_000).toISOString());
  });

  it("routes a gas smell as an emergency and names the national line", () => {
    const result = triageReport("I can smell gas in the hallway outside room 2.", NOW);
    expect(result.emergency).toBe("gas");
    expect(result.urgency).toBe("emergency");
    expect(result.category).toBe("heating");
    expect(result.replyBy).toBe(new Date(NOW.getTime() + 3_600_000).toISOString());
    expect(result.guidance?.body).toContain("0800 111 999");
  });

  it("routes carbon monoxide, fire, flood, and sparks onto emergency paths", () => {
    expect(triageReport("The CO alarm is sounding.", NOW).emergency).toBe("co");
    expect(triageReport("There is smoke and a fire in the kitchen.", NOW).emergency).toBe("fire");
    expect(triageReport("A burst pipe is flooding the hall.", NOW).emergency).toBe("flood");
    expect(triageReport("Sparks are coming out of the socket.", NOW).category).toBe("electrical");
    expect(triageReport("Sparks are coming out of the socket.", NOW).urgency).toBe("emergency");
  });

  it("sends a dead boiler to heating as urgent, and mice to pests", () => {
    const boiler = triageReport("The boiler is dead and we have no heating.", NOW);
    expect(boiler.category).toBe("heating");
    expect(boiler.urgency).toBe("urgent");
    expect(triageReport("There are mice in the kitchen cupboards.", NOW).category).toBe("pests");
  });

  it("keeps a leaking washing machine with appliances", () => {
    const result = triageReport("The washing machine is leaking from the door.", NOW);
    expect(result.category).toBe("appliances");
    expect(result.urgency).toBe("urgent");
  });
});

describe("lettings book", () => {
  it("matches the sample rent board", () => {
    const summary = rentSummary(seedBook());
    expect(summary.received).toBe(8450);
    expect(summary.late).toBe(450);
    expect(summary.due).toBe(0);
    expect(summary.collectedPct).toBe(95);
    expect(gbp(summary.received)).toBe("£8,450");
  });

  it("shows 12 Oak Road flat 2 at 12% below the market figure", () => {
    const priya = seedBook().properties[0].rooms[0];
    expect(priya.tenantName).toBe("Priya Shah");
    expect(marketPosition(priya.rentPcm, priya.marketRentPcm)).toEqual({
      pct: 12,
      direction: "below",
    });
  });

  it("keeps Harbour Lane as room-level tenancies", () => {
    const hmo = seedBook().properties.find((property) => property.hmo);
    expect(hmo?.rooms).toHaveLength(5);
    expect(hmo?.address).toBe("8 Harbour Lane");
  });

  it("issues the next reference and walks a repair to tenant confirmation", () => {
    const book = seedBook();
    const repair = createRepair(book, {
      propertyId: "p_oak",
      roomId: "r_oak2",
      body: "The bedroom lock is broken and I cannot lock the door.",
      channel: "qr",
      now: NOW,
    });
    expect(repair.reference).toBe("R-2026-0143");
    expect(repair.category).toBe("locks");
    let next = addRepair(book, repair);
    expect(tryConfirmRepair(next, repair.reference, "Priya Shah", NOW.toISOString())).toBe(next);
    next = acknowledgeRepair(next, repair.id, "Called Priya.", NOW.toISOString());
    next = markFixed(next, repair.id, "Lock replaced.", undefined, NOW.toISOString());
    next = tryConfirmRepair(next, "r-2026-0143", "Priya Shah", NOW.toISOString());
    expect(next.repairs.find((item) => item.id === repair.id)?.status).toBe("tenant_confirmed");
  });

  it("merges an inbox repair once", () => {
    const book = seedBook();
    const repair = createRepair(book, {
      propertyId: "p_station",
      roomId: "r_station3",
      body: "Damp is showing on the bedroom wall.",
      channel: "whatsapp",
      now: NOW,
    });
    const inbox = { ...emptyInbox(), repairs: [repair, repair] };
    const first = applyInbox(book, inbox);
    expect(first.book.repairs.filter((item) => item.id === repair.id)).toHaveLength(1);
    const second = applyInbox(first.book, { ...emptyInbox(), repairs: [repair] });
    expect(second.book.repairs.filter((item) => item.id === repair.id)).toHaveLength(1);
  });

  it("builds a dispute pack that names the repair and escapes markup", () => {
    const book = seedBook();
    book.properties[0].rooms[0].tenantName = `Priya <script>alert("x")</script>`;
    const html = buildDisputePack(book, "p_oak", NOW);
    expect(html).toContain("R-2026-0139");
    expect(html).toContain("Form 4A");
    expect(html).toContain("12 Oak Road");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    const wales = buildDisputePack(book, "p_station", NOW);
    expect(wales).toContain("RHW12");
    const scotland = buildDisputePack(book, "p_leith", NOW);
    expect(scotland).toContain("Rent Service Scotland");
  });

  it("blocks a booking when the contractor’s insurance has expired", () => {
    const book = seedBook();
    const jordan = book.properties.find((property) => property.hmo)?.rooms.find((room) => room.tenantName === "Jordan Hale");
    expect(book.properties[0].rooms[0].rightToRent).toBe("clear");
    expect(jordan?.rightToRent).toBe("pending");
    expect(book.properties.find((property) => property.reportToken === "station-road")?.tenancyStage).toBe("marketing");
    expect(book.keys.some((key) => key.propertyId === "p_oak")).toBe(true);
    expect(() =>
      bookTradesperson(book, "rep_gas", { name: "QuickFix Electrics", when: "2026-10-25T10:00" }, NOW.toISOString()),
    ).toThrow(/insurance/);
    const booked = bookTradesperson(
      book,
      "rep_gas",
      { name: "M. Patel Plumbing", when: "2026-10-25T10:00" },
      NOW.toISOString(),
    );
    expect(booked.repairs.find((item) => item.id === "rep_gas")?.tradesperson).toBe("M. Patel Plumbing");
  });
});

import { describe, expect, it } from "vitest";
import { createAppointment, createOffer, draftListing, draftSaleSummary, seedAgencyBook } from "@/lib/agency/book";
import { PROGRESSION } from "@/lib/agency/types";

describe("agency book", () => {
  it("seeds a diary, an offer, and four client links", () => {
    const book = seedAgencyBook();
    expect(book.appointments).toHaveLength(2);
    expect(book.offers[0]?.amount).toBe(425000);
    expect(book.portals.map((item) => item.role).sort()).toEqual(["buyer", "landlord", "tenant", "vendor"]);
    expect(book.bookingToken).toBe("harbour");
  });

  it("rejects a booking without a name", () => {
    expect(() =>
      createAppointment({
        bookToken: "harbour",
        kind: "viewing",
        at: "2026-10-24T10:00",
        clientName: "A",
        address: "14 Elm Grove",
      }),
    ).toThrow(/name/);
  });

  it("files an offer with an amount", () => {
    const offer = createOffer({ address: "14 Elm Grove", buyerName: "Sam Okonkwo", amount: 510000 });
    expect(offer.status).toBe("submitted");
    expect(offer.amount).toBe(510000);
  });

  it("drafts a listing and a sale summary from the fields on file", () => {
    const listing = draftListing({
      title: "14 Elm Grove",
      address: "14 Elm Grove",
      city: "Greenwich",
      beds: 3,
      baths: 2,
      price: 725000,
      market: "uk",
      tenure: "freehold",
    });
    expect(listing).toContain("£725,000");
    expect(listing).toContain("viewing");
    const summary = draftSaleSummary({
      listingTitle: "14 Elm Grove",
      stage: "Offer",
      parties: ["Alex Harbour"],
      checklist: [{ label: "Survey", done: false }],
      value: 725000,
      currency: "GBP",
    });
    expect(summary).toContain("Next: Survey");
    expect(PROGRESSION).toContain("Exchanged");
  });
});

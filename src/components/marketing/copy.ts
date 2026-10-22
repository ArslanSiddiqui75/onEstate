import { getActiveBrand } from "@/lib/brand/config";

export function getMarketingCopy() {
  const brand = getActiveBrand();
  const uk = brand.market === "uk";

  return {
    brand,
    uk,
    nav: [
      { href: "#software", label: "Software" },
      { href: "#clients", label: "Clients" },
      { href: "#diary", label: "Diary" },
      { href: "#ai", label: "AI" },
    ],
    heroEyebrow: uk ? "Estate agency software" : "Real estate software",
    heroTitle: uk ? "Every enquiry finds its next step." : "Every enquiry finds its next step.",
    heroBody: uk
      ? "Capture the lead, book the viewing, move the sale, and give vendors, buyers, landlords, and tenants a link of their own."
      : "Capture the lead, book the showing, move the sale, and give sellers, buyers, and landlords a link of their own.",
    primaryCta: "Book a demo",
    proof: uk
      ? [
          "One login for the office",
          "England, Wales, and Scotland",
          "Stock prepared for Rightmove, Zoopla, and OnTheMarket",
          "Vendor, buyer, landlord, and tenant links",
        ]
      : [
          "One login for the office",
          "Sales and leases on one record",
          "Stock prepared for the MLS",
          "Seller, buyer, and landlord links",
        ],
    pillars: [
      {
        title: "Workflows",
        body: uk
          ? "Reply-by clocks, follow-ups, and repair routes run from the record, so the team stays on the deal."
          : "Follow-ups and next steps run from the record, so the team stays on the deal.",
      },
      {
        title: "One pipeline",
        body: uk
          ? "Enquiry, viewing, offer, and progression sit on the same property. Nothing has to be copied into a second system."
          : "Enquiry, showing, offer, and progression sit on the same property. Nothing has to be copied into a second system.",
      },
      {
        title: "Client access",
        body: "The people you act for open a link. They approve, book, report, and read progress without calling the office.",
      },
    ],
    stories: uk
      ? [
          {
            id: "enquiry",
            eyebrow: "Enquiry centre",
            title: "Every lead in one place.",
            body: "Website, portal, and office enquiries land on one list, with the property, the source, and the next step.",
          },
          {
            id: "progression",
            eyebrow: "Sales progression",
            title: "From listed to exchanged.",
            body: "The deal moves through viewing, offer, and progression. The checklist, the fee request, and the referral stay on that file.",
          },
          {
            id: "diary",
            eyebrow: "Online bookings",
            title: "Clients book without a phone call.",
            body: "A viewing or a valuation request comes in on a link. The office confirms it on the diary.",
          },
        ]
      : [
          {
            id: "enquiry",
            eyebrow: "Enquiry centre",
            title: "Every lead in one place.",
            body: "Website and office enquiries land on one list, with the property, the source, and the next step.",
          },
          {
            id: "progression",
            eyebrow: "Sales progression",
            title: "From listed to closed.",
            body: "The deal moves through showing, offer, and progression. The checklist, the fee request, and the referral stay on that file.",
          },
          {
            id: "diary",
            eyebrow: "Online bookings",
            title: "Clients book without a phone call.",
            body: "A showing or a valuation request comes in on a link. The office confirms it on the diary.",
          },
        ],
    clients: uk
      ? [
          {
            id: "vendor",
            title: "Vendor",
            body: "Approve the listing, read the viewing feedback, and see the sale move, without chasing the negotiator.",
          },
          {
            id: "buyer",
            title: "Buyer",
            body: "Book a viewing and submit an offer from the same link the office uses to track the property.",
          },
          {
            id: "landlord",
            title: "Landlord",
            body: "See the rent line and approve a repair from the phone. The property manager supervises, rather than chasing.",
          },
          {
            id: "tenant",
            title: "Tenant",
            body: "Report a repair by link, QR, or the words you’d text. Gas, fire, flood, and dangerous electrics take an emergency route.",
          },
        ]
      : [
          {
            id: "vendor",
            title: "Seller",
            body: "Approve the listing, read the showing feedback, and see the sale move, without chasing the agent.",
          },
          {
            id: "buyer",
            title: "Buyer",
            body: "Book a showing and submit an offer from the same link the office uses to track the property.",
          },
          {
            id: "landlord",
            title: "Landlord",
            body: "See the rent line and approve a repair. The office supervises, rather than chasing.",
          },
          {
            id: "tenant",
            title: "Resident",
            body: "Report a maintenance issue by link. The office files a trade, a clock, and a reference.",
          },
        ],
    sampleTitle: "Harbour & Co, a sample office.",
    sampleBody: uk
      ? "14 Elm Grove has a viewing at 14:00, an offer on 8 Harbour Street, and the vendor can approve the listing from their link. It is sample stock, so you can see the desk before your own properties are on it."
      : "14 Elm Street has a showing at 2:00, an offer on file, and the seller can approve the listing from their link. It is sample stock, so you can see the desk before your own properties are on it.",
    blocks: [
      {
        title: "Drafts",
        body: "A listing description and a sale summary are written from the fields already on the record. You edit them before anyone else sees them.",
      },
      {
        title: "Referrals",
        body: "Note who introduced the deal, whether the fee is agreed, and what it is. It stays on the progression, not in a side spreadsheet.",
      },
      {
        title: "Client payments",
        body: "Request a fee on the deal and mark it received. When Stripe is connected, the request can go out that way. Otherwise the office records it here.",
      },
    ],
    facts: uk
      ? [
          ["4", "Client links on every instruction"],
          ["1", "Diary for viewings and valuations"],
          ["3", "Nations on the lettings desk"],
        ]
      : [
          ["3", "Client links on a listing"],
          ["1", "Diary for showings and valuations"],
          ["1", "Record from enquiry to close"],
        ],
    supportTitle: "The office and the client see the same record.",
    supportBody:
      "A booking, an offer, a repair, and an approval land on the desk the team already uses. Sign in and open Enquiries, Diary, or Lettings.",
    contactTitle: "See it on your own stock.",
    contactBody: uk
      ? "Tell us about the office. We’ll walk through enquiries, the diary, progression, and the client links."
      : "Tell us about the office. We’ll walk through enquiries, the diary, progression, and the client links.",
    footerLine: uk ? "Estate agency software for the UK." : "Real estate software for the United States.",
  };
}

import { getActiveBrand } from "@/lib/brand/config";

export function getMarketingCopy() {
  const brand = getActiveBrand();
  const uk = brand.market === "uk";

  return {
    brand,
    uk,
    nav: [
      { href: "#software", label: "Software" },
      { href: "#websites", label: "Websites" },
      { href: "#portal", label: "Client portal" },
    ],
    heroEyebrow: uk ? "Estate agency software" : "Real estate software",
    heroTitle: uk
      ? "The whole agency, in one place."
      : "The whole brokerage, in one place.",
    heroBody: uk
      ? "Sales, lettings, your website, and a client portal. One login for the office, and a place for vendors and landlords to follow progress any time."
      : "Sales, leases, your website, and a client portal. One login for the office, and a place for sellers and landlords to follow progress any time.",
    primaryCta: "Book a demo",
    softwareEyebrow: "Software",
    softwareTitle: uk
      ? "Sales, lettings, and the office diary."
      : "Sales, leases, and the office diary.",
    softwareBody: uk
      ? "Keep valuations, viewings, offers, and stock on the same record. Listings go out to Rightmove, Zoopla, and OnTheMarket without a second system."
      : "Keep valuations, showings, offers, and stock on the same record. Listings go out to the MLS without a second system.",
    softwarePoints: uk
      ? [
          {
            title: "Diary and valuations",
            body: "See who is out, what is booked, and which instruction needs a call.",
          },
          {
            title: "Sales and lettings",
            body: "Follow a sale to completion. For lets, tenants report repairs by link, QR, or text, and the rent book, certificates, and inspections sit on the same desk.",
          },
          {
            title: "Portals",
            body: "Send stock to Rightmove, Zoopla, and OnTheMarket from the listing itself.",
          },
        ]
      : [
          {
            title: "Diary and valuations",
            body: "See who is out, what is booked, and which listing needs a call.",
          },
          {
            title: "Sales and leases",
            body: "Follow a property from the first enquiry through to closing or move-in.",
          },
          {
            title: "MLS",
            body: "Prepare stock for the MLS from the listing itself.",
          },
        ],
    websitesEyebrow: "Websites",
    websitesTitle: "A site that stays in step with your stock.",
    websitesBody:
      "A branded site for the agency, with listings that update when the stock does. Built for phone and desktop, with enquiries coming back into the same office.",
    portalEyebrow: "Client portal",
    portalTitle: "A login for the people you act for.",
    portalBody: uk
      ? "Win instructions by giving vendors and landlords somewhere to look, day or night, instead of waiting on a call back."
      : "Win listings by giving sellers and landlords somewhere to look, day or night, instead of waiting on a call back.",
    portalPoints: uk
      ? [
          "See live progress on a sale or let",
          "Share and download documents",
          "Follow viewings and offers",
          "Read statements when they are ready",
          "Message the negotiator",
          "Add another property",
        ]
      : [
          "See live progress on a sale or lease",
          "Share and download documents",
          "Follow showings and offers",
          "Read statements when they are ready",
          "Message the agent",
          "Add another property",
        ],
    contactTitle: "See it on your own stock.",
    contactBody: uk
      ? "Tell us about the office. We’ll walk through the software, the website, and the client portal."
      : "Tell us about the office. We’ll walk through the software, the website, and the client portal.",
    footerLine: uk
      ? "Estate agency software for the UK."
      : "Real estate software for the United States.",
  };
}

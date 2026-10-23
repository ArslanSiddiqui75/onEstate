import { getActiveBrand, getBrandByMarket } from "@/lib/brand/config";
import type { Market } from "@/types";

export function getMarketingCopy(market: Market = getActiveBrand().market) {
  const brand = getBrandByMarket(market);
  const uk = market === "uk";
  const viewing = uk ? "viewing" : "showing";
  const exchange = uk ? "exchange" : "close";

  return {
    brand,
    uk,
    nav: [
      { href: "#jobs", label: "The desk" },
      { href: "#product", label: uk ? "Sales & lettings" : "Sales & listings" },
      { href: "#clients", label: "Clients" },
      { href: "#pricing", label: "Pricing" },
    ],
    banner: "Listing drafts are written from the record. You edit them before they go anywhere.",
    heroLead: "The desk that",
    heroPhrases: uk
      ? ["fills the diary", "takes the offer", "writes the listing", "updates the vendor", "files the repair"]
      : ["fills the diary", "takes the offer", "writes the listing", "updates the seller", "prepares the stock"],
    heroTitle: uk
      ? "The desk that fills the diary."
      : "The desk that fills the diary.",
    heroBody: uk
      ? "0neStreet is the desk the office actually works from. Leads, the diary, listings prepared for the portals, offers, progression, lettings, documents, and a private link for the vendor, buyer, landlord, and tenant."
      : "0neStreet is the desk the office actually works from. Leads, the diary, listings prepared for the MLS, offers, progression, documents, and a private link for the seller, buyer, and landlord.",
    heroNotes: uk
      ? ["One login for the office", "England, Wales, and Scotland", "Client links, not another phone chase"]
      : ["One login for the office", "Sales on one record", "Client links, not another phone chase"],
    primaryCta: "Book a demo",
    jobs: uk
      ? [
          {
            id: "diary",
            title: "Fill the diary",
            body: "A viewing or a valuation comes in on a link. The office confirms it. The appointment stays on the property, not in someone’s inbox.",
            frame: "diary" as const,
          },
          {
            id: "offer",
            title: "Take the offer",
            body: "The buyer submits from their link, or the negotiator records it. Progression shows listed, viewing, offer, progressing, exchanged.",
            frame: "progression" as const,
          },
          {
            id: "listing",
            title: "Write the listing",
            body: "The description is drafted from the fields already on the record, in time for the vendor to approve it from their link.",
            frame: "vendor" as const,
          },
          {
            id: "enquiry",
            title: "Catch the enquiry",
            body: "Website, portal, and office leads land on one list, with the property, the source, and the next step.",
            frame: "enquiry" as const,
          },
          {
            id: "repair",
            title: "File the repair",
            body: "The tenant reports by link. Gas, fire, flood, and dangerous electrics take an emergency route. Everything else gets a clock on the lettings desk.",
            frame: "landlord" as const,
          },
        ]
      : [
          {
            id: "diary",
            title: "Fill the diary",
            body: "A showing or a valuation comes in on a link. The office confirms it. The appointment stays on the property.",
            frame: "diary" as const,
          },
          {
            id: "offer",
            title: "Take the offer",
            body: "The buyer submits from their link, or the agent records it. Progression shows listed, showing, offer, progressing, closed.",
            frame: "progression" as const,
          },
          {
            id: "listing",
            title: "Write the listing",
            body: "The description is drafted from the fields already on the record, ready for the seller to approve from their link.",
            frame: "vendor" as const,
          },
          {
            id: "enquiry",
            title: "Catch the enquiry",
            body: "Website and office leads land on one list, with the property, the source, and the next step.",
            frame: "enquiry" as const,
          },
          {
            id: "stock",
            title: "Prepare the stock",
            body: "The listing pack shows what is ready for the MLS and what is not connected yet. You are not told a board has already taken the feed.",
            frame: "desk" as const,
          },
        ],
    pillars: uk
      ? [
          {
            eyebrow: "Sales",
            title: "More of the deal stays on one thread.",
            points: [
              "Turn up to the valuation with a draft already written",
              "See the offer, the viewing, and the feedback together",
              "Progress the file through to exchange without retyping it",
            ],
            href: "#jobs",
            cta: "See the sales desk",
          },
          {
            eyebrow: "Lettings",
            title: "The tenancy has its own desk.",
            points: [
              "Repairs, with an emergency route and a reply clock",
              "Right to Rent, keys, and contractor warnings on the property",
              "Certificates, inspections, and a dispute pack when you need one",
            ],
            href: "#lettings",
            cta: "See lettings",
          },
          {
            eyebrow: "The office",
            title: "The rest of the week, in the same login.",
            points: [
              "CRM with calls, SMS, and sequences",
              "A branded site, scheduled social posts, and e-sign",
              "Tasks, reports, teams, and a fee request on the deal",
            ],
            href: "#pricing",
            cta: "See pricing",
          },
        ]
      : [
          {
            eyebrow: "Sales",
            title: "More of the deal stays on one thread.",
            points: [
              "Turn up to the valuation with a draft already written",
              "See the offer, the showing, and the feedback together",
              "Progress the file through to close without retyping it",
            ],
            href: "#jobs",
            cta: "See the sales desk",
          },
          {
            eyebrow: "Listings",
            title: "Stock prepared before anyone is asked to publish.",
            points: [
              "A listing pack with MLS readiness and connection status",
              "Drafts you edit before the seller or the site sees them",
              "Documents and media on the same file as the offer",
            ],
            href: "#jobs",
            cta: "See the listing desk",
          },
          {
            eyebrow: "The office",
            title: "The rest of the week, in the same login.",
            points: [
              "CRM with calls, SMS, and sequences",
              "A branded site, scheduled social posts, and e-sign",
              "Tasks, reports, teams, and a fee request on the deal",
            ],
            href: "#pricing",
            cta: "See pricing",
          },
        ],
    scales: [
      {
        eyebrow: "Solo",
        title: "Runs without a second hire.",
        body: uk
          ? "One user. Enquiries, the diary, listing drafts, and the progression checklist. £49 a month, in pounds."
          : "One user. Enquiries, the diary, listing drafts, and the progression checklist. $59 a month, in dollars.",
        href: "/app/signup?plan=solo",
        cta: "Start solo",
      },
      {
        eyebrow: "Team and multi-office",
        title: "One standard as the office grows.",
        body: "Team is up to 25 people, with lead routing and client links. Enterprise routes across offices. Same record, more seats.",
        href: "#pricing",
        cta: "Compare plans",
      },
    ],
    reasons: uk
      ? [
          { title: "One record", body: "The enquiry, the viewing, the offer, and the file are the same property. Nothing is copied into a second system to progress it." },
          { title: "Client links", body: "Vendor, buyer, landlord, and tenant open a link. They approve, book, offer, and report. They do not need an account." },
          { title: "Drafts you approve", body: "A listing description and a sale summary are written from the fields on the record. You edit them before anyone else sees them." },
          { title: "A price you can read", body: "Solo is £49. Team is £199. Enterprise is a conversation. Billing is in pounds. No invented bundle hiding the number." },
          { title: "A seat for each job", body: "Owner, broker, team lead, agent, assistant, and accountant. The CRM stays shared across the office." },
          { title: "Lettings, properly", body: "Repairs, rent, Right to Rent, keys, gas, EICR, EPC, deposits, HMO, alarms, inspections, and a dispute pack. England, Wales, and Scotland." },
        ]
      : [
          { title: "One record", body: "The enquiry, the showing, the offer, and the file are the same property. Nothing is copied into a second system to progress it." },
          { title: "Client links", body: "Seller, buyer, and landlord open a link. They approve, book, and offer. They do not need an account." },
          { title: "Drafts you approve", body: "A listing description and a sale summary are written from the fields on the record. You edit them before anyone else sees them." },
          { title: "A price you can read", body: "Solo is $59. Team is $249. Enterprise is a conversation. Billing is in dollars." },
          { title: "A seat for each job", body: "Owner, broker, team lead, agent, assistant, and accountant. The CRM stays shared across the office." },
          { title: "Stock, prepared", body: "Listing packs show MLS readiness and what is not connected. You are not told a board has already accepted the feed." },
        ],
    facts: uk
      ? [
          ["4", "Client links on an instruction"],
          ["3", "Nations on the lettings desk"],
          ["£49", "Solo, billed monthly"],
          ["1", "Diary for the whole office"],
        ]
      : [
          ["3", "Client links on a listing"],
          ["1", "Record from enquiry to close"],
          ["$59", "Solo, billed monthly"],
          ["1", "Diary for the whole office"],
        ],
    proof: uk
      ? [
          "Enquiry centre",
          "Diary and public booking",
          "Rightmove, Zoopla, and OnTheMarket packs",
          "Sales progression",
          "Lettings desk",
          "Vendor, buyer, landlord, and tenant links",
        ]
      : [
          "Enquiry centre",
          "Diary and public booking",
          "MLS-ready stock",
          "Sales progression",
          "Website and social",
          "Seller, buyer, and landlord links",
        ],
    chapters: uk
      ? [
          {
            id: "product",
            eyebrow: "The desk",
            title: "Every job the negotiator already does, on one record.",
            lede: "Nothing here is a separate product you bolt on later. The lead, the appointment, the offer, and the file are the same property.",
            items: [
              {
                title: "Enquiry centre",
                body: "Website, portal, and office enquiries land on one list. Each row keeps the property, the source, and the next step, so a lead is never a loose email.",
              },
              {
                title: "Diary",
                body: "Viewings and valuations sit on the office diary. A public booking link lets someone request a time. The office confirms it. The appointment stays on the property.",
              },
              {
                title: "Offers and progression",
                body: "The deal moves through listed, viewing, offer, progressing, and exchanged. The checklist, the fee request, and who introduced the deal stay on that file.",
              },
              {
                title: "Tasks",
                body: "Follow-ups are open or done against the lead. The morning list is the work, not a second notebook.",
              },
              {
                title: "Reports",
                body: "Live counts of the pipeline and the stock. Enough to see the office, without exporting five spreadsheets first.",
              },
              {
                title: "Teams and roles",
                body: "Owner, broker, team lead, agent, assistant, and accountant. Office groups exist. The CRM stays shared, so a contact is not trapped in one person’s inbox.",
              },
            ],
          },
          {
            id: "stock",
            eyebrow: "The stock",
            title: "The listing, the paperwork, and the public face.",
            lede: "Stock is prepared for Rightmove, Zoopla, and OnTheMarket. Publishing itself is marked where it is still coming. What you can do today is get the pack, the draft, and the file ready.",
            items: [
              {
                title: "Listings and portals",
                body: "A listing pack with portal readiness and sync status. The UK feed names Rightmove, Zoopla, and OnTheMarket, so the office can see what is prepared and what is not connected.",
              },
              {
                title: "Listing drafts",
                body: "A description is written from the fields already on the record. You edit it before a vendor, a portal, or the public site ever sees it.",
              },
              {
                title: "Documents and e-sign",
                body: "Uploads, listing media, and e-sign live with the deal. The signature is on the file the progression already uses.",
              },
              {
                title: "Website",
                body: "A branded brokerage site: headline, call to action, and a publish state. Solo includes one site. Team adds the client portal. Enterprise covers a multi-office network.",
              },
              {
                title: "Social",
                body: "Connect the accounts you already use, upload media, and schedule posts. On the Team plan, a listing can become a post. Enterprise adds brand controls across offices.",
              },
              {
                title: "CRM",
                body: "Pipeline, address book, SMS, calls, and sequences in the same workspace as the property. Team adds lead routing and scoring. Enterprise routes across offices.",
              },
            ],
          },
          {
            id: "lettings",
            eyebrow: "Lettings",
            title: "The UK lettings book, not a note in the sales file.",
            lede: "Repairs, rent, compliance, and the people on the tenancy have their own desk. It covers England, Wales, and Scotland.",
            items: [
              {
                title: "Repairs",
                body: "A tenant reports by link, QR, or the words they would text. Gas, fire, flood, and dangerous electrics take an emergency route. Routine jobs carry a reply clock.",
              },
              {
                title: "Right to Rent, keys, contractors",
                body: "Right to Rent sits on the person. Keys are logged to the property. Contractor warnings are visible before someone is sent back to a job.",
              },
              {
                title: "Compliance",
                body: "Gas safety, EICR, EPC, deposits, HMO licences, and alarms. Attach the certificate name when you have proof of service.",
              },
              {
                title: "Inspections",
                body: "Check-in and later inspections, room by room, waiting on the tenant’s sign-off or already signed.",
              },
              {
                title: "Rent",
                body: "The landlord sees the rent line from their link. The property manager supervises it instead of reconstructing it from emails.",
              },
              {
                title: "Dispute pack",
                body: "One pack for the tenancy: rent position, every repair and its clocks, the certificates on file, and inspection sign-off.",
              },
            ],
          },
        ]
      : [
          {
            id: "product",
            eyebrow: "The desk",
            title: "Every job the agent already does, on one record.",
            lede: "The lead, the appointment, the offer, and the file are the same property. You do not copy the deal into a second system to progress it.",
            items: [
              {
                title: "Enquiry centre",
                body: "Website and office enquiries land on one list. Each row keeps the property, the source, and the next step.",
              },
              {
                title: "Diary",
                body: "Showings and valuations sit on the office diary. A public booking link lets someone request a time. The office confirms it on the property.",
              },
              {
                title: "Offers and progression",
                body: "The deal moves through listed, showing, offer, progressing, and closed. The checklist, the fee request, and the referral stay on that file.",
              },
              {
                title: "Tasks",
                body: "Follow-ups are open or done against the lead. The morning list is the work.",
              },
              {
                title: "Reports",
                body: "Live counts of the pipeline and the inventory, read inside the office rather than exported first.",
              },
              {
                title: "Teams and roles",
                body: "Owner, broker, team lead, agent, assistant, and accountant. Office groups exist. The CRM stays shared.",
              },
            ],
          },
          {
            id: "stock",
            eyebrow: "The stock",
            title: "The listing, the paperwork, and the public face.",
            lede: "Stock is prepared for the MLS. The pack, the draft, and the file are ready before anyone is asked to publish.",
            items: [
              {
                title: "Listings and the MLS",
                body: "A listing pack with readiness and sync status for the MLS. The office can see what is prepared and what is not connected.",
              },
              {
                title: "Listing drafts",
                body: "A description is written from the fields already on the record. You edit it before a seller or the public site sees it.",
              },
              {
                title: "Documents and e-sign",
                body: "Uploads, listing media, and e-sign live with the deal, on the same progression the checklist uses.",
              },
              {
                title: "Website",
                body: "A branded brokerage site: headline, call to action, and a publish state. Solo is one site. Team adds the client portal. Enterprise covers multiple offices.",
              },
              {
                title: "Social",
                body: "Connect accounts, upload media, and schedule posts. Team can turn a listing into a post. Enterprise adds brand controls across offices.",
              },
              {
                title: "CRM",
                body: "Pipeline, address book, SMS, calls, and sequences beside the property. Team adds lead routing and scoring. Enterprise routes across offices.",
              },
            ],
          },
        ],
    steps: [
      {
        n: "01",
        title: "The lead arrives",
        body: uk
          ? "A portal, the website, or the office. The enquiry keeps its source and the property it is about."
          : "The website or the office. The enquiry keeps its source and the property it is about.",
      },
      {
        n: "02",
        title: `The ${viewing} is booked`,
        body: `They use a link, or the negotiator books it. It lands on the diary for the office to confirm.`,
      },
      {
        n: "03",
        title: "The offer is on the file",
        body: `The buyer submits from their link, or the office records it. Progression shows where the deal actually is.`,
      },
      {
        n: "04",
        title: `Through to ${exchange}`,
        body: "Checklist, documents, e-sign, the fee request, and the referral note stay on that same record.",
      },
    ],
    clients: uk
      ? [
          {
            id: "vendor",
            title: "Vendor",
            body: "Approves the listing, reads the viewing feedback, and watches the sale move. They stop chasing the negotiator for an update that is already on the file.",
          },
          {
            id: "buyer",
            title: "Buyer",
            body: "Books a viewing and submits an offer from the same link the office uses to track the property. The offer is not a separate email thread.",
          },
          {
            id: "landlord",
            title: "Landlord",
            body: "Sees the rent line and approves a repair from the phone. The property manager supervises the tenancy instead of assembling it from messages.",
          },
          {
            id: "tenant",
            title: "Tenant",
            body: "Reports a repair by link, QR, or ordinary language. Emergencies are routed. Everything else gets a clock, a contractor, and a place on the lettings desk.",
          },
        ]
      : [
          {
            id: "vendor",
            title: "Seller",
            body: "Approves the listing, reads the showing feedback, and watches the sale move without calling the agent for a status that is already written down.",
          },
          {
            id: "buyer",
            title: "Buyer",
            body: "Books a showing and submits an offer from the same link the office uses to track the property.",
          },
          {
            id: "landlord",
            title: "Landlord",
            body: "Sees the rent line and approves a repair. The office supervises the record instead of chasing updates.",
          },
        ],
    roles: [
      { title: "Owner", body: "The workspace, the plan, the seats, and the billing." },
      { title: "Broker", body: "The book of business across the office, not one negotiator’s private list." },
      { title: "Team lead", body: "The group’s pipeline, tasks, and who has the next step." },
      { title: "Agent", body: "Their stock, their diary, and the client links on those instructions." },
      { title: "Assistant", body: "Enquiries, bookings, documents, and the chase list." },
      { title: "Accountant", body: "Fee requests, what was received, and the plan the office is on." },
    ],
    checklist: uk
      ? [
          "Enquiry centre with source and property",
          "Diary for viewings and valuations",
          "Public booking link",
          "Offers on the property",
          "Progression through to exchange",
          "Listing packs for Rightmove, Zoopla, and OnTheMarket",
          "Listing drafts you edit before they go out",
          "Documents, media, and e-sign",
          "Branded website",
          "Social scheduling",
          "CRM with SMS, calls, and sequences",
          "Tasks and reports",
          "Teams, with a shared CRM",
          "Lettings: repairs, rent, Right to Rent",
          "Keys, contractor warnings, inspections",
          "Gas, EICR, EPC, deposits, HMO, alarms",
          "Dispute pack",
          "Vendor, buyer, landlord, and tenant links",
          "Fee requests and referral notes",
          "Plans and seats, billed in pounds",
          "Support tickets to the platform",
        ]
      : [
          "Enquiry centre with source and property",
          "Diary for showings and valuations",
          "Public booking link",
          "Offers on the property",
          "Progression through to close",
          "Listing packs prepared for the MLS",
          "Listing drafts you edit before they go out",
          "Documents, media, and e-sign",
          "Branded website",
          "Social scheduling",
          "CRM with SMS, calls, and sequences",
          "Tasks and reports",
          "Teams, with a shared CRM",
          "Seller, buyer, and landlord links",
          "Fee requests and referral notes",
          "Plans and seats, billed in dollars",
          "Support tickets to the platform",
        ],
    faqs: uk
      ? [
          {
            q: "Is the UK book a different product from the US book?",
            a: "Same software, separate setups. This site is the UK book: pounds, lettings, and vendor, buyer, landlord, and tenant links. The US book is showings, MLS-ready stock, and dollars.",
          },
          {
            q: "Do you publish straight to Rightmove?",
            a: "Listings are prepared for Rightmove, Zoopla, and OnTheMarket, with a readiness and connection status. Live portal publishing on the Team plan is marked as coming soon. You are not told it is already switching the portals on.",
          },
          {
            q: "What can a client do without an account?",
            a: "They open a link. Vendors approve the listing and read feedback. Buyers book and offer. Landlords see rent and approve repairs. Tenants report a repair. The office still owns the file.",
          },
          {
            q: "Do we have to use Stripe?",
            a: "No. You can record a fee request and mark it received on the deal. When Stripe is connected, the request can go out that way. Subscriptions for the software itself are billed in pounds.",
          },
          {
            q: "Who is the lettings desk for?",
            a: "UK offices with landlords and tenants. It is not on the US setup. Repairs, Right to Rent, keys, certificates, inspections, and a dispute pack live here.",
          },
          {
            q: "Can one negotiator start alone?",
            a: "Solo Agent is one user at £49 a month: enquiries, the diary, listing drafts, the progression checklist, and payments in pounds. Team is the office, up to 25 people.",
          },
        ]
      : [
          {
            q: "Is the US book a different product from the UK book?",
            a: "Same software, separate setups. This site is the US book: dollars, showings, and MLS-ready stock. Lettings for England, Wales, and Scotland live on the UK setup.",
          },
          {
            q: "Does stock go to the MLS by itself?",
            a: "Listings are prepared for the MLS, with readiness and connection status. You can see what is ready. You are not told a board has already accepted the feed.",
          },
          {
            q: "What can a client do without an account?",
            a: "They open a link. Sellers approve the listing and read feedback. Buyers book a showing and submit an offer. Landlords see the rent line and approve a repair. The office still owns the file.",
          },
          {
            q: "Do we have to use Stripe?",
            a: "No. You can record a fee request and mark it received on the deal. When Stripe is connected, the request can go out that way. Subscriptions are billed in dollars.",
          },
          {
            q: "Can one agent start alone?",
            a: "Solo Agent is one user at $59 a month: enquiries, the diary, listing drafts, the progression checklist, and payments in dollars. Team is the office, up to 25 people.",
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
        body: uk
          ? "Request a fee on the deal and mark it received. In pounds. When Stripe is connected, the request can go out that way."
          : "Request a fee on the deal and mark it received. In dollars. When Stripe is connected, the request can go out that way.",
      },
    ],
    supportTitle: uk
      ? "The negotiator and the client are looking at the same file."
      : "The agent and the client are looking at the same file.",
    supportBody: `A booking, an offer, a document, and an approval land on the desk the team already uses. Sign in and open Enquiries, Diary, or the ${viewing}.`,
    contactTitle: "See it on your own stock.",
    contactBody: uk
      ? "Tell us about the office. We’ll walk the enquiry list, the diary, progression, lettings, and the four client links."
      : "Tell us about the office. We’ll walk the enquiry list, the diary, progression, and the client links.",
    footerLine: uk
      ? "Estate agency software for the UK. Payments in pounds."
      : "Real estate software for the United States. Payments in dollars.",
    pricingTitle: uk ? "UK pricing, in pounds." : "US pricing, in dollars.",
    pricingBody: uk
      ? "The UK book includes lettings, viewings, and client links for vendors, buyers, landlords, and tenants."
      : "The US book includes showings, MLS-ready stock, and client links for sellers, buyers, and landlords.",
  };
}

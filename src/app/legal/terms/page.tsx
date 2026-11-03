import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/legal/legal-shell";
import { requestMarket } from "@/lib/brand/request";

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await requestMarket();
  return {
    title: `Terms of Service · ${brand.name}`,
    description: `Terms of Service, Terms of Use, and product conditions for ${brand.name}.`,
  };
}

export default async function TermsPage() {
  const { brand } = await requestMarket();
  const uk = brand.market === "uk";
  const company = brand.name;
  const domain = brand.domain;
  const currency = uk ? "pounds sterling (GBP)" : "US dollars (USD)";
  const law = uk ? "the laws of England and Wales" : "the laws of the State of Delaware, USA";
  const courts = uk
    ? "the courts of England and Wales"
    : "the state and federal courts located in Delaware";

  return (
    <LegalShell title="Terms of Service & Terms of Use" updated="3 November 2026">
      <LegalSection id="agreement" title="1. Agreement to these terms">
        <p>
          These Terms of Service and Terms of Use (the “Terms”) govern access to and use of the{" "}
          {company} platform at {domain} and related applications, APIs, public sites, booking
          links, client portals, and messaging services (together, the “Service”). By creating a
          workspace, clicking to accept these Terms at signup, paying for a plan, or using the
          Service, you agree to these Terms on behalf of yourself and the brokerage, agency, or
          organisation you represent (the “Customer”).
        </p>
        <p>
          If you do not agree, do not create an account or use the Service. Our{" "}
          <Link href="/legal/privacy" className="font-semibold text-[var(--accent)]">
            Privacy Policy
          </Link>{" "}
          explains how we handle personal data and forms part of your agreement with us when you
          use the Service.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="2. Accounts, workspaces, and eligibility">
        <p>
          You must provide accurate registration details (name, work email, phone, brokerage name,
          and plan). You are responsible for safeguarding login credentials and for activity under
          your account. Notify us promptly of unauthorised access.
        </p>
        <p>
          Each paid signup creates one Customer workspace. Seats, roles, and module access inside
          that workspace are controlled by the workspace owner and authorised brokers. You may not
          share a single login across people who should each have a seat under your plan.
        </p>
        <p>
          You confirm you are at least 18 years old and have authority to bind the Customer to
          these Terms. You must comply with local real-estate, lettings, advertising, consumer,
          and data-protection laws that apply to your business.
        </p>
      </LegalSection>

      <LegalSection id="plans" title="3. Plans, billing, and taxes">
        <p>
          {company} offers Solo, Team, and Enterprise plans. Published prices are billed in{" "}
          {currency} unless we agree otherwise in writing. Checkout is processed by Stripe; card
          details are handled by Stripe, not stored as full PAN data in {company}.
        </p>
        <p>
          Subscriptions renew until cancelled. Fees are generally non-refundable except where
          required by law or expressly stated at checkout. Failed payments, unpaid invoices, or
          admin suspension may pause non-billing modules until the account is current. Enterprise
          commercial terms may supplement these Terms where signed separately.
        </p>
        <p>
          You are responsible for applicable taxes. Seat limits, portal-feed ceilings, and feature
          flags described in the product (for example lead routing or client portal) follow the
          plan you purchase.
        </p>
      </LegalSection>

      <LegalSection id="service" title="4. The Service — modules covered">
        <p>
          {company} is a multi-tenant brokerage operating system. Depending on your plan, market,
          and role permissions, the Service may include the modules below. Module availability can
          change as we ship updates; these Terms apply to each module you enable or use.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>CRM, contacts, conversations, and automations.</strong> Lead pipelines, contact
            directory, inbox SMS/email threads, tasks, sequences, scoring, routing, and workflow
            automations.
          </li>
          <li>
            <strong>Listings and portals.</strong> Stock management and portal/MLS connection
            settings. Live HTTP publishing to partner portals depends on commercial credentials and
            partner APIs; export and readiness tooling may be available before live push.
          </li>
          <li>
            <strong>Transactions, compliance, e-sign, and documents.</strong> Deal checklists,
            compliance status, document storage hooks, and electronic signature requests via
            integrated providers.
          </li>
          <li>
            <strong>Website builder and domains.</strong> Branded public sites, domain connection
            (including registrar integrations where offered), and published listing pages.
          </li>
          <li>
            <strong>Social tools.</strong> Connecting social accounts via OAuth, drafting and
            scheduling posts, and publishing where the provider allows.
          </li>
          <li>
            <strong>Phone and email channels.</strong> Workspace phone numbers via Twilio, outbound
            SMS, call logging, and sending from a connected customer email domain.
          </li>
          <li>
            <strong>Diary, booking, and client portals.</strong> Viewing/showing scheduling and
            tokenised public client links where enabled for your workspace.
          </li>
          <li>
            <strong>Lettings desk (where offered).</strong> Tenancy, rent, and related office
            workflows for supported jurisdictions. Generated notices are operational aids, not legal
            advice.
          </li>
          <li>
            <strong>Teams, settings, reports, tickets, and billing.</strong> Member invites, RBAC
            and per-member module grants, reporting, support tickets, and plan management.
          </li>
          <li>
            <strong>Agency / multi-book surfaces.</strong> Hosted books and related indexes where
            your plan and configuration enable them.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="crm-messaging" title="5. CRM, messaging, consent, and personal Do Not Disturb">
        <p>
          CRM data is organisation-wide within your workspace. Assignment fields route work; they
          do not create a separate private database per agent unless a feature expressly says so.
        </p>
        <p>
          <strong>Agency-wide consent / opt-out.</strong> When a recipient opts out of SMS (or you
          mark a number opted out), that consent state applies to the phone number for the
          workspace. The Service blocks further SMS to opted-out numbers. You must honour legal
          opt-out and quiet-hours rules that apply to you.
        </p>
        <p>
          <strong>Personal Do Not Disturb (DND).</strong> A signed-in user may place a contact on
          DND for their own account. Personal DND stops that user from sending SMS or email to the
          contact from {company}; it does not opt the contact out for the whole agency, and it does
          not prevent teammates from messaging unless they also set DND or the number is opted out.
          You remain responsible for how your team uses personal DND versus legal consent.
        </p>
        <p>
          You are the controller (or equivalent) of customer, lead, and tenant personal data you
          upload. {company} processes that data to provide the Service. You must have a lawful basis
          to contact people through SMS, email, phone, or automation.
        </p>
      </LegalSection>

      <LegalSection id="phone-email" title="6. Phone numbers, SMS, and email">
        <p>
          Phone numbers purchased or connected through the Service are provisioned via Twilio or
          other carriers we integrate. Carrier and country rules apply; inbound SMS reliability
          varies by region. Calling from the product may open the device dialler and log outcomes
          rather than providing in-app WebRTC.
        </p>
        <p>
          Email sending requires you to connect and verify a domain you control. You must maintain
          DNS records and honour unsubscribe and anti-spam laws. We may suspend sending that
          threatens deliverability or violates these Terms.
        </p>
      </LegalSection>

      <LegalSection id="listings-portals" title="7. Listings, portals, and advertising">
        <p>
          You are solely responsible for listing accuracy, photos, pricing, tenure/MLS disclosures,
          fair-housing / equality advertising rules, and portal or board requirements. Connecting a
          portal does not guarantee acceptance by that portal. Credentials you store are used only
          to operate the integration for your workspace.
        </p>
      </LegalSection>

      <LegalSection id="transactions-esign" title="8. Transactions, e-sign, and documents">
        <p>
          Checklists, compliance flags, and document tools help your office track work; they are
          not a substitute for licensed conveyancing, brokerage compliance review, or legal advice.
          Electronic signatures are delivered through third-party e-sign providers. Signature
          validity depends on the provider, the document, and applicable law. You must verify
          signer identity and authority as your profession requires.
        </p>
      </LegalSection>

      <LegalSection id="website-social" title="9. Website builder and social publishing">
        <p>
          Published sites and social posts are your content. You grant {company} a limited licence
          to host, transmit, and display that content to operate the Service. Do not publish
          unlawful, infringing, or deceptive material. Social networks may revoke tokens, rate-limit
          publishing, or change APIs; we are not liable for platform outages or policy changes.
        </p>
        <p>
          Social connections are scoped to your workspace. Do not use another organisation’s OAuth
          tokens or attempt to mix accounts across workspaces.
        </p>
      </LegalSection>

      <LegalSection id="lettings-portals-public" title="10. Lettings, diary, and public client links">
        <p>
          {uk
            ? "Lettings features may reference England, Wales, and Scotland processes (for example rent-increase forms). "
            : "Where lettings or rental modules appear, "}
          Generated packs and notices are for office use and are not legal advice. You must check
          statutory notice periods, deposit schemes, licensing (including HMO), and local
          requirements before serving any notice.
        </p>
        <p>
          Public booking links, portal pages, and tokenised client views expose only what your
          workspace configures. Protect those links; anyone with the URL may open the content you
          published.
        </p>
      </LegalSection>

      <LegalSection id="team-rbac" title="11. Team access and roles">
        <p>
          Owners and brokers may invite members, change roles, and turn modules on or off per
          member within plan limits. You are responsible for granting least privilege appropriate
          to each seat. Removing a member does not delete historical records they created unless
          you delete that data separately.
        </p>
      </LegalSection>

      <LegalSection id="aup" title="12. Acceptable use">
        <p>You will not, and will not allow others to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Violate law, including spam, privacy, consumer, housing, or sanctions rules.</li>
          <li>Send SMS or email without required consent or after a valid opt-out.</li>
          <li>Probe, overload, reverse engineer, or disrupt the Service or other tenants.</li>
          <li>Upload malware, scrape other customers’ data, or bypass access controls.</li>
          <li>Resell the Service or use it to build a competing product without written consent.</li>
          <li>Misrepresent affiliation with {company} or with portals, MLS boards, or carriers.</li>
        </ul>
        <p>We may investigate and suspend accounts that breach this section.</p>
      </LegalSection>

      <LegalSection id="customer-data" title="13. Customer data and confidentiality">
        <p>
          As between the parties, Customer retains ownership of Customer Data (leads, contacts,
          listings, messages, documents, and similar content you submit). We use Customer Data to
          provide, secure, and improve the Service, and as described in the Privacy Policy. We do
          not sell Customer Data.
        </p>
        <p>
          Each party will protect the other’s confidential information with reasonable care and use
          it only for performing under these Terms, except for information that is public,
          independently developed, or required to be disclosed by law.
        </p>
      </LegalSection>

      <LegalSection id="third-parties" title="14. Third-party services">
        <p>
          The Service depends on providers such as hosting, databases, Stripe, Twilio, email
          delivery, e-sign, domain registrars, social networks, and property portals. Their terms
          also apply to your use of those features. Outages or policy changes at those providers
          may affect {company} features without constituting a breach by us where outside our
          reasonable control.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="15. Intellectual property">
        <p>
          {company}, including software, designs, trademarks, and documentation, remains our
          property or that of our licensors. These Terms grant a limited, non-exclusive,
          non-transferable right to use the Service during an active subscription. Feedback you
          provide may be used freely to improve the product.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="16. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY
          LAW, WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. WE DO NOT WARRANT UNINTERRUPTED OR ERROR-FREE OPERATION, PERFECT
          DELIVERABILITY OF SMS OR EMAIL, OR THAT AUTOMATIONS, PORTAL SYNCS, OR GENERATED FORMS
          MEET EVERY REGULATORY REQUIREMENT FOR YOUR TRANSACTION.
        </p>
        <p>
          {company} is software for real-estate professionals. It is not a law firm, accountant,
          mortgage broker, or substitute for licensed advice in your market.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="17. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE FOR INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR
          GOODWILL. OUR AGGREGATE LIABILITY ARISING OUT OF THESE TERMS OR THE SERVICE IN ANY
          TWELVE-MONTH PERIOD WILL NOT EXCEED THE FEES YOU PAID TO {company.toUpperCase()} FOR THE
          SERVICE IN THAT PERIOD.
        </p>
        <p>
          Nothing in these Terms excludes liability that cannot be limited under applicable law
          (including death or personal injury caused by negligence, or fraud).
        </p>
      </LegalSection>

      <LegalSection id="indemnity" title="18. Indemnity">
        <p>
          Customer will defend and indemnify {company} against claims arising from Customer Data,
          Customer’s use of messaging and advertising channels, listing content, notices served to
          tenants or consumers, or Customer’s breach of these Terms or law, except to the extent
          caused by our wilful misconduct.
        </p>
      </LegalSection>

      <LegalSection id="suspension" title="19. Suspension and termination">
        <p>
          You may stop using the Service and cancel under your plan’s billing settings. We may
          suspend or terminate for non-payment, legal risk, security incidents, or material breach.
          After termination, access ends and we may delete or anonymise Customer Data after a
          reasonable retention window, subject to legal holds and the Privacy Policy. Sections that
          by nature should survive (fees owed, IP, confidentiality, disclaimers, liability,
          indemnity, governing law) survive termination.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="20. Changes to the Service or Terms">
        <p>
          We may update the Service and these Terms. Material changes will be posted on this page
          with an updated date and, where appropriate, notified in-product or by email. Continued
          use after the effective date constitutes acceptance. If you do not agree, cancel before
          the changes take effect.
        </p>
      </LegalSection>

      <LegalSection id="law" title="21. Governing law">
        <p>
          These Terms are governed by {law}, without regard to conflict-of-law rules. Courts of{" "}
          {courts} have exclusive jurisdiction, except that we may seek injunctive relief in any
          forum for IP or security threats.
        </p>
      </LegalSection>

      <LegalSection id="general" title="22. General">
        <p>
          These Terms are the entire agreement for the Service and supersede prior proposals on the
          same subject. If a provision is unenforceable, the rest remains in effect. Failure to
          enforce a provision is not a waiver. You may not assign these Terms without our consent;
          we may assign them in connection with a merger or sale of assets. Notices may be sent to
          the email on your account or posted in the Service.
        </p>
        <p>
          By completing signup and checking that you accept these Terms, you acknowledge that you
          have read the Terms of Service, Terms of Use, and Privacy Policy, and that you agree to
          them for all modules of the Service available to your plan.
        </p>
      </LegalSection>
    </LegalShell>
  );
}

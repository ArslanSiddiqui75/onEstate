import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/legal/legal-shell";
import { requestMarket } from "@/lib/brand/request";

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await requestMarket();
  return {
    title: `Privacy Policy · ${brand.name}`,
    description: `How ${brand.name} collects, uses, and shares personal data.`,
  };
}

export default async function PrivacyPage() {
  const { brand } = await requestMarket();
  const company = brand.name;
  const uk = brand.market === "uk";

  return (
    <LegalShell title="Privacy Policy" updated="3 November 2026">
      <LegalSection id="intro" title="1. Who we are">
        <p>
          This Privacy Policy explains how {company} (“we”, “us”) processes personal data when you
          visit our marketing sites, create a workspace, or use the brokerage platform described in
          our{" "}
          <Link href="/legal/terms" className="font-semibold text-[var(--accent)]">
            Terms of Service
          </Link>
          .
        </p>
        <p>
          {uk
            ? "For UK and EEA users, we process personal data under UK GDPR / GDPR principles. "
            : "For US users, we process personal data under applicable US state privacy laws where they apply. "}
          If you use {company} to store information about your own clients and leads, you are
          typically the controller of that Customer Data; we act as a processor / service provider
          for hosting and operating the product.
        </p>
      </LegalSection>

      <LegalSection id="collect" title="2. Data we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account data:</strong> name, email, phone, password (hashed via our auth
            provider), brokerage name, plan, billing status, and role.
          </li>
          <li>
            <strong>Workspace content you submit:</strong> leads, contacts, messages, call logs,
            listings, deals, documents metadata, website content, social drafts, lettings records,
            diary entries, and support tickets.
          </li>
          <li>
            <strong>Integration data:</strong> connected phone numbers, email domains, portal
            credentials you choose to store, social OAuth tokens (encrypted where configured), and
            payment references from Stripe.
          </li>
          <li>
            <strong>Usage and device data:</strong> approximate logs needed for security, debugging,
            and reliability (IP, user agent, timestamps, error traces).
          </li>
          <li>
            <strong>Marketing form data:</strong> demo or waitlist submissions from public pages.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="use" title="3. How we use data">
        <p>We use personal data to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide, secure, and support the Service across CRM, messaging, listings, deals, website, social, lettings, and billing modules.</li>
          <li>Process subscriptions and prevent fraud.</li>
          <li>Send product, security, and billing notices.</li>
          <li>Improve features and diagnose incidents.</li>
          <li>Comply with law and enforce our Terms.</li>
        </ul>
        <p>We do not sell personal data.</p>
      </LegalSection>

      <LegalSection id="sharing" title="4. Sharing">
        <p>
          We share data with subprocessors that help us run the product (for example cloud hosting,
          authentication/database, Stripe for payments, Twilio for SMS/phone, email delivery,
          e-sign providers, domain registrars, and social or portal platforms you connect). We may
          disclose data if required by law or to protect rights and safety. In a merger or asset
          sale, data may transfer under continued confidentiality commitments.
        </p>
      </LegalSection>

      <LegalSection id="messaging" title="5. Messaging and contact preferences">
        <p>
          Workspace users decide who to contact. Agency-wide SMS opt-outs are stored on phone
          records so the workspace stops texting that number. Personal Do Not Disturb settings are
          stored per signed-in user and are not a substitute for legal consent or opt-out. If you
          are a consumer who received a message from a brokerage using {company}, contact that
          brokerage directly to exercise rights against them; we can help route the request when
          you identify the workspace.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="6. Retention and security">
        <p>
          We retain account and Customer Data while the workspace is active and for a reasonable
          period afterward for backups, disputes, and legal requirements. We use industry-standard
          controls (encryption in transit, access controls, service-role separation) but no method
          is perfectly secure.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="7. Your rights">
        <p>
          Depending on your location, you may have rights to access, correct, delete, or export
          personal data, or to object to certain processing. Account holders can update many
          profile fields in Settings. For other requests, contact us via the demo/contact form on
          our site and include enough detail to locate your account. We may need to verify identity
          before acting.
        </p>
      </LegalSection>

      <LegalSection id="children" title="8. Children">
        <p>
          The Service is built for adult real-estate professionals and is not directed to children
          under 16 (or the equivalent minimum age in your region).
        </p>
      </LegalSection>

      <LegalSection id="changes" title="9. Changes">
        <p>
          We may update this Policy and will revise the “Last updated” date above. Material changes
          may also be notified in-product or by email.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="10. Contact">
        <p>
          Privacy questions: use the contact / demo form on{" "}
          <Link href="/#contact" className="font-semibold text-[var(--accent)]">
            our homepage
          </Link>{" "}
          and mark the message as a privacy request.
        </p>
      </LegalSection>
    </LegalShell>
  );
}

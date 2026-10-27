"use client";

import { Suspense } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { useModuleSection } from "@/lib/nav/module-section";
import { SectionPills } from "@/components/ui/section-pills";
import PhoneNumberSettingsPage from "../phone/page";
import EmailDomainSettingsPage from "../email/page";
import RoutingSettingsPage from "../routing/page";

const SECTIONS = ["phone", "email", "routing"] as const;
type PhoneSection = (typeof SECTIONS)[number];

function PhoneSystem() {
  const { user, org } = useAppSession();
  const canRoute = Boolean(user && org && hasModuleAccess(user.role, org.plan, "crm", "view"));
  const [section, setSection] = useModuleSection("section", SECTIONS, "phone");
  const shown: PhoneSection = section === "routing" && !canRoute ? "phone" : section;
  const items: { id: PhoneSection; label: string }[] = [
    { id: "phone", label: "Phone number" },
    { id: "email", label: "Email domain" },
  ];
  if (canRoute) items.push({ id: "routing", label: "Lead routing" });

  return (
    <div className="space-y-5">
      <SectionPills
        label="Phone System"
        value={shown}
        onChange={setSection}
        items={items}
      />
      {shown === "email" ? (
        <EmailDomainSettingsPage />
      ) : shown === "routing" ? (
        <RoutingSettingsPage />
      ) : (
        <PhoneNumberSettingsPage />
      )}
    </div>
  );
}

export default function PhoneSystemPage() {
  return (
    <Suspense fallback={null}>
      <PhoneSystem />
    </Suspense>
  );
}

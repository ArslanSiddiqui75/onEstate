"use client";

import { Suspense } from "react";
import { CrmDesk } from "@/app/app/(workspace)/crm/page";
import { DealsBoard } from "@/app/app/(workspace)/transactions/page";
import { useModuleSection } from "@/lib/nav/module-section";
import { SectionPills } from "@/components/ui/section-pills";

function Opportunities() {
  const [section, setSection] = useModuleSection("view", ["pipeline", "deals"] as const, "pipeline");

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-[var(--muted)]">
        Website, portal, and office enquiries arrive here as new opportunities, with the source, the property, and the next step.
      </p>
      <SectionPills
        label="Opportunities"
        value={section}
        onChange={setSection}
        items={[
          { id: "pipeline", label: "Pipeline" },
          { id: "deals", label: "Deals" },
        ]}
      />
      {section === "deals" ? <DealsBoard /> : <CrmDesk view="pipeline" />}
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={null}>
      <Opportunities />
    </Suspense>
  );
}

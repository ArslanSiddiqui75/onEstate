"use client";

import { Suspense } from "react";
import { CrmDesk } from "@/app/app/(workspace)/crm/page";

export default function RoutingSettingsPage() {
  return (
    <Suspense fallback={null}>
      <CrmDesk view="routing" />
    </Suspense>
  );
}

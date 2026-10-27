"use client";

import { usePathname } from "next/navigation";
import { SectionPillLinks } from "@/components/ui/section-pills";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { SETTINGS_SECTIONS } from "@/lib/nav/settings-sections";

export function SettingsSectionNav() {
  const pathname = usePathname();
  const { user, org } = useAppSession();
  const items = SETTINGS_SECTIONS.filter((section) => {
    if (!user || !org) return true;
    if (section.module && !hasModuleAccess(user.role, org.plan, section.module, "view")) {
      return false;
    }
    if (
      section.anyOf &&
      !section.anyOf.some((module) => hasModuleAccess(user.role, org.plan, module, "view"))
    ) {
      return false;
    }
    return true;
  });

  return (
    <SectionPillLinks
      label="Settings"
      items={items.map((section) => ({ href: section.href, label: section.short }))}
      isActive={(href) =>
        href === "/app/settings"
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`)
      }
    />
  );
}

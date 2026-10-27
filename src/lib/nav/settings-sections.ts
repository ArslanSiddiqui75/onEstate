import type { ModuleId } from "@/types";

export type SettingsSection = {
  href: string;
  short: string;
  eyebrow: string;
  title: string;
  description: string;
  module?: ModuleId;
  anyOf?: readonly ModuleId[];
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    href: "/app/settings",
    short: "Workspace",
    eyebrow: "Workspace",
    title: "Settings",
    description: "Contact details, workspace, and the brokerage business profile.",
  },
  {
    href: "/app/settings/team",
    short: "Team",
    eyebrow: "People",
    title: "Team",
    description: "Everyone in the workspace. The owner changes roles and removes people.",
  },
  {
    href: "/app/settings/phone-system",
    short: "Phone System",
    eyebrow: "Phone System",
    title: "Phone System",
    description: "The number you text from, the domain you send from, and who receives the next enquiry.",
  },
  {
    href: "/app/settings/social",
    short: "Social accounts",
    eyebrow: "Social",
    title: "Social accounts",
    description: "Connect Instagram, Facebook, LinkedIn, and X. Compose and the queue stay on Social.",
    module: "social",
  },
  {
    href: "/app/settings/reports",
    short: "Reports",
    eyebrow: "Book",
    title: "Reports",
    description: "Pipeline, stock, deals, tasks, conversations, and the rest of the book.",
    module: "crm",
  },
  {
    href: "/app/settings/documents",
    short: "Documents",
    eyebrow: "Files",
    title: "Documents",
    description: "Uploads, e-sign, and listing media.",
    anyOf: ["crm", "listings", "transactions"],
  },
  {
    href: "/app/settings/support",
    short: "Support",
    eyebrow: "Help",
    title: "Support",
    description: "Tickets with platform support, and how urgent each one is.",
  },
  {
    href: "/app/settings/billing",
    short: "Billing",
    eyebrow: "Plan",
    title: "Billing",
    description: "Plan, seats, invoices, and the card on file.",
    module: "billing",
  },
];

const PHONE_SYSTEM_PATHS = [
  "/app/settings/phone-system",
  "/app/settings/phone",
  "/app/settings/email",
  "/app/settings/routing",
];

export function settingsSectionMatches(pathname: string, href: string) {
  if (href === "/app/settings") return pathname === href;
  if (href === "/app/settings/phone-system") {
    return PHONE_SYSTEM_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function settingsSectionFor(pathname: string) {
  const nested = SETTINGS_SECTIONS.find(
    (section) => section.href !== "/app/settings" && settingsSectionMatches(pathname, section.href),
  );
  if (nested) return nested;
  if (pathname === "/app/settings") return SETTINGS_SECTIONS[0];
  return undefined;
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { PlatformAdminRole } from "@/lib/admin/types";
import { AdminGateLogin } from "./gate-login";

export const metadata: Metadata = {
  title: "Sign in",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

const ROLES = new Set<PlatformAdminRole>([
  "super_admin",
  "billing_admin",
  "support_admin",
]);

function isPlatformAdminRole(value: string | null): value is PlatformAdminRole {
  return value != null && ROLES.has(value as PlatformAdminRole);
}

export default async function AdminGatePage() {
  // Only reachable via opaque slug rewrite that sets this request header.
  const role = (await headers()).get("x-admin-gate-role");
  if (!isPlatformAdminRole(role)) notFound();
  return <AdminGateLogin role={role} />;
}

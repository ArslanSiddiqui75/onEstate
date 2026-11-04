import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
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

export default async function AdminGatePage() {
  // Only reachable via opaque slug rewrite that sets this request header.
  const role = (await headers()).get("x-admin-gate-role");
  if (!role) notFound();
  return <AdminGateLogin />;
}

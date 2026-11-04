import { notFound } from "next/navigation";

/** Classic `/admin/login` is retired — operators use opaque per-role gates. */
export default function RetiredAdminLoginPage() {
  notFound();
}

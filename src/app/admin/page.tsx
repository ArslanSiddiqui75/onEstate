import { AdminOverview } from "@/components/admin/overview";
import { stripeRegionConnections } from "@/lib/stripe/config";

export default function AdminOverviewPage() {
  return <AdminOverview connections={stripeRegionConnections()} />;
}

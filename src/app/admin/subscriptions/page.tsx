import { SubscriptionsBoard } from "@/components/admin/subscriptions-board";
import { stripeRegionConnections } from "@/lib/stripe/config";

export default function AdminSubscriptionsPage() {
  return <SubscriptionsBoard connections={stripeRegionConnections()} />;
}

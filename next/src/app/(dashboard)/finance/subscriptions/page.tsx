import { getSubscriptionAnalytics } from "@/actions/finance/subscriptions";
import { SubscriptionsPage } from "@/components/finance/subscriptions-page";
import { ModuleGate } from "@/components/shared/module-gate";

export default async function SubscriptionsPageRoute() {
  const analytics = await getSubscriptionAnalytics();

  return (
    <ModuleGate moduleKey="finance">
      <SubscriptionsPage initialAnalytics={analytics} />
    </ModuleGate>
  );
}

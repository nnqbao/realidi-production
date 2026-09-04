import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getSessionUser } from "@/lib/auth/session";
import { convexQuery } from "@/lib/convex/server";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";

export default async function OnboardingPage() {
  const session = await getSessionUser().catch(() => null);
  if (!session) redirect("/login?next=/onboarding");
  const catalog = await convexQuery(api.profiles.onboardingCatalog, {});
  return (
    <OnboardingFlow
      currentStates={catalog.currentStates}
      desired={catalog.desired}
      styles={catalog.styles}
    />
  );
}

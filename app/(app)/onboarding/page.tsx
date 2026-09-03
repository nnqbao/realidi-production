import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getCurrentStateMoods, getDesiredMoods, getStyles } from "@/features/mood/queries";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";

export default async function OnboardingPage() {
  const session = await getSessionUser().catch(() => null);
  if (!session) redirect("/login?next=/onboarding");
  const [currentStates, desired, styles] = await Promise.all([
    getCurrentStateMoods(),
    getDesiredMoods(),
    getStyles(),
  ]);
  return <OnboardingFlow currentStates={currentStates} desired={desired} styles={styles} />;
}

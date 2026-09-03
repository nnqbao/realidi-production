import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getDesiredMoods } from "@/features/mood/queries";
import { CreateExperienceFlow } from "@/features/experiences/create-flow";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";

export default async function CreatePage() {
  const session = await getSessionUser().catch(() => null);
  if (!session) {
    return (
      <EmptyState
        title="Đăng nhập để chia sẻ trải nghiệm"
        description="Chia sẻ trải nghiệm bạn đã thực sự sống — không phải bài đăng cho đủ."
        action={
          <Button asChild>
            <Link href="/login?next=/create">Đăng nhập</Link>
          </Button>
        }
      />
    );
  }
  let places: { id: string; name: string; district: string | null }[] = [];
  let moods: Awaited<ReturnType<typeof getDesiredMoods>> = [];
  try {
    const supabase = await createServerSupabase();
    const [placeRows, moodRows] = await Promise.all([
      supabase.from("places").select("id, name, district").eq("status", "active").order("name").limit(120),
      getDesiredMoods(),
    ]);
    places = (placeRows.data ?? []) as { id: string; name: string; district: string | null }[];
    moods = moodRows;
  } catch {
    return <ErrorState title="Không mở được tạo trải nghiệm" description="Thử lại sau." />;
  }
  return (
    <CreateExperienceFlow
      places={places}
      moods={moods}
      userId={session.user.id}
    />
  );
}

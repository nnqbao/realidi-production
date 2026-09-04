import { api } from "@/convex/_generated/api";
import { requireUser } from "@/lib/auth/session";
import { assertAdmin } from "@/lib/auth/roles";
import { convexQueryAuthed } from "@/lib/convex/server";
import { adminRunSeed } from "@/features/admin/console-actions";
import { Button } from "@/components/ui/button";

export default async function AdminSeedPage() {
  const status = await convexQueryAuthed(api.seed.statusAuthorized, {}).catch(() => null);
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl">Seed dữ liệu</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Chạy seed taxonomy + địa điểm editorial trên Convex. Không hiện khóa hay mật khẩu.
      </p>
      {status ? (
        <p className="mt-4 text-sm text-[#6F7480]">
          {status.complete ? "Seed đã đủ." : "Seed chưa đủ."} checksum {status.checksum}
        </p>
      ) : null}
      <form
        className="mt-6"
        action={async () => {
          "use server";
          const session = await requireUser();
          assertAdmin(session.profile.role);
          await adminRunSeed();
        }}
      >
        <Button type="submit">Chạy seed Convex</Button>
      </form>
    </div>
  );
}

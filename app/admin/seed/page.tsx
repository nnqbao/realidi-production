import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import { assertAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";

export default function AdminSeedPage() {
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl">Seed dữ liệu</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Chạy SQL taxonomy + places từ supabase/seed.sql bằng service role. Không tạo user auth — dùng scripts/seed-demo.ts
        cho hồ sơ demo.
      </p>
      <form
        className="mt-6"
        action={async () => {
          "use server";
          const session = await requireUser();
          assertAdmin(session.profile.role);
          const sql = await readFile(path.join(process.cwd(), "supabase/seed.sql"), "utf8");
          const admin = createAdminClient();
          const { error } = await admin.rpc("exec_sql" as never, { sql } as never);
          if (error) {
            throw new Error(
              "RPC exec_sql không có trên project này. Hãy dán supabase/seed.sql vào SQL Editor của Supabase.",
            );
          }
          revalidatePath("/home");
          revalidatePath("/explore");
        }}
      >
        <Button type="submit">Thử seed qua RPC</Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Cách đáng tin: Supabase Dashboard → SQL → dán nội dung seed.sql, hoặc `supabase db reset` local.
      </p>
    </div>
  );
}

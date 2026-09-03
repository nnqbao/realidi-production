import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { ProfileEditForm } from "@/features/profile/edit-form";

export default async function EditProfilePage() {
  const session = await getSessionUser().catch(() => null);
  if (!session) redirect("/login?next=/profile/edit");
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-display text-3xl">Sửa hồ sơ</h1>
      <ProfileEditForm />
    </div>
  );
}

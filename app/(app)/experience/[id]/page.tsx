import { redirect } from "next/navigation";

export default async function ExperienceAlias({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/post/${id}`);
}

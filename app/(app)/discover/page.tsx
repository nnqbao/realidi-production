import { redirect } from "next/navigation";

export default async function DiscoverRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") next.set(key, value);
  }
  const qs = next.toString();
  redirect(qs ? `/explore?${qs}` : "/explore");
}

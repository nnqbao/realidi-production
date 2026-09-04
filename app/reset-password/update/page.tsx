import { UpdatePasswordForm } from "./update-form";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <UpdatePasswordForm email={email ?? ""} />;
}

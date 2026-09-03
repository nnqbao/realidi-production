import { LoginForm } from "@/features/auth/login-form";
import { safeReturnPath } from "@/lib/auth/return-to";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeReturnPath(params.next, "/home");
  return (
    <main className="min-h-dvh bg-background">
      <div className="bg-brand px-4 py-10 text-white">
        <p className="font-display text-2xl text-white">Realidi</p>
        <p className="mt-2 max-w-md text-sm text-white/70">Mạng xã hội cho trải nghiệm đi thật.</p>
      </div>
      <div className="px-4 py-12">
        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}

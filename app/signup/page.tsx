import { SignupForm } from "@/features/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="bg-brand px-4 py-10 text-white">
        <p className="font-display text-2xl text-white">Realidi</p>
        <p className="mt-2 max-w-md text-sm text-white/70">Mạng xã hội cho trải nghiệm đi thật.</p>
      </div>
      <div className="px-4 py-12">
        <SignupForm />
      </div>
    </main>
  );
}

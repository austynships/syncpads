import Link from "next/link";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSession } from "@/lib/session";

export default async function AppPage() {
  const { user } = await requireSession();

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <SessionKeepAlive />
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="mb-4">
          Signed in as <strong>{user.email}</strong>
        </p>
        <SignOutButton />
        <Link href="/settings" className="mt-4 block text-sm text-zinc-600 underline">
          Settings
        </Link>
      </div>
    </main>
  );
}


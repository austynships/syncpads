"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AuthCard, Button, Field } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setLoading(false);

    if (!error) {
      router.push("/app");
      router.refresh();
      return;
    }
    if (error.status === 429) {
      setError(error.message ?? "Too many attempts. Try again later.");
    } else if (error.status === 403) {
      setError("Please verify your email first. We've sent you a new link.");
    } else {
      // Same message for unknown email and wrong password.
      setError("Email or password is incorrect.");
    }
  }

  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          New to SyncPads? <Link href="/signup" className="underline">Create an account</Link>
        </>
      }
    >
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={onSubmit}>
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <div className="mb-4 text-right text-sm">
          <Link href="/forgot-password" className="text-zinc-600 underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}


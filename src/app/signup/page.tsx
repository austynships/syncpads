"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, AuthCard, Button, Field } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email,
      password,
      callbackURL: "/app", // where the verification link lands
    });
    setLoading(false);

    if (error) setError(error.message ?? "Could not create your account.");
    else setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email" footer={<Link href="/login">Back to sign in</Link>}>
        <p className="text-sm text-zinc-700">
          We sent a verification link to <strong>{sentTo}</strong>. Click it to finish creating your
          account.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      footer={
        <>
          Already have an account? <Link href="/login" className="underline">Sign in</Link>
        </>
      }
    >
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={onSubmit}>
        <Field label="Name" name="name" type="text" autoComplete="name" required />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password (at least 8 characters)"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}


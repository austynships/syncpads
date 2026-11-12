"use client";

import Link from "next/link";
import { useState } from "react";
import { IconCheck, IconMail } from "@/components/icons";
import { Clarity } from "@/components/clarity";
import { ResendVerification } from "@/components/resend-verification";
import { Alert, AuthCard, Button, Field, StatusIcon, linkClass } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const longEnough = password.length >= 8;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));

    if (!longEnough) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email,
      password,
      callbackURL: "/verify-email", // where the verification link lands
    });
    setLoading(false);

    if (error) setError(error.message ?? "Could not create your account.");
    else setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthCard
        icon={
          <StatusIcon tone="brand">
            <IconMail size={22} />
          </StatusIcon>
        }
        title="Verify your email"
        subtitle={
          <>
            We sent a link to <strong className="text-slate-900">{sentTo}</strong>. Click it to finish creating your
            workspace.
          </>
        }
        footer={
          <>
            Wrong address?{" "}
            <button type="button" className={linkClass} onClick={() => setSentTo(null)}>
              Use a different email
            </button>
          </>
        }
      >
        <ResendVerification email={sentTo} />
        <p className="mt-4 text-xs text-slate-500">Can&apos;t find it? Check your spam or promotions folder.</p>
      </AuthCard>
    );
  }

  return (
    <>
    <Clarity />
    <AuthCard
      title="Create your workspace"
      subtitle="Bring your links, tools and notes together in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={linkClass}>
            Sign in
          </Link>
        </>
      }
    >
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={onSubmit}>
        <Field label="Name" name="name" type="text" autoComplete="name" placeholder="Alex Morgan" required />
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={
            <span className={`inline-flex items-center gap-1 ${longEnough ? "text-emerald-700" : ""}`}>
              {longEnough ? <IconCheck size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
              At least 8 characters
            </span>
          }
        />
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Creating your workspace…" : "Create workspace"}
        </Button>
      </form>
    </AuthCard>
    </>
  );
}

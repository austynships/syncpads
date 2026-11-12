import Link from "next/link";
import { IconAlert, IconCheck, IconMail } from "@/components/icons";
import { ResendVerification } from "@/components/resend-verification";
import { AuthCard, StatusIcon, linkClass } from "@/components/ui";
import { getSession } from "@/lib/session";
import { GoToApp } from "./go-to-app";

export const metadata = { title: "Verify your email" };

// Verification links land here (callbackURL "/verify-email"). Better Auth has
// already checked the token: on success the user is signed in; on failure it
// adds ?error=TOKEN_EXPIRED or ?error=INVALID_TOKEN.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = error ? null : await getSession();

  if (session?.user.emailVerified) {
    return (
      <AuthCard
        icon={
          <StatusIcon tone="success">
            <IconCheck size={22} />
          </StatusIcon>
        }
        title="Email verified"
        subtitle="You're all set. Taking you to your workspace…"
      >
        <GoToApp />
      </AuthCard>
    );
  }

  if (error) {
    return (
      <AuthCard
        icon={
          <StatusIcon tone="warning">
            <IconAlert size={22} />
          </StatusIcon>
        }
        title={error === "TOKEN_EXPIRED" ? "This link has expired" : "This link isn't valid"}
        subtitle="Enter your email and we'll send you a new verification link."
        footer={
          <Link href="/login" className={linkClass}>
            Back to sign in
          </Link>
        }
      >
        <ResendVerification primary />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={
        <StatusIcon tone="brand">
          <IconMail size={22} />
        </StatusIcon>
      }
      title="Verify your email"
      subtitle="Open the link we emailed you to finish creating your workspace. Need a new one?"
      footer={
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      }
    >
      <ResendVerification primary />
    </AuthCard>
  );
}

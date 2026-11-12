import Link from "next/link";
import { IconAlert } from "@/components/icons";
import { AuthCard, StatusIcon, linkClass } from "@/components/ui";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password" };

// The emailed link goes to /api/auth/reset-password/:token, which redirects
// here with ?token=... (or ?error=INVALID_TOKEN if it expired).
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <AuthCard
        icon={
          <StatusIcon tone="warning">
            <IconAlert size={22} />
          </StatusIcon>
        }
        title="This link has expired"
        subtitle="Reset links last 1 hour and work once. Request a new one to continue."
        footer={
          <Link href="/login" className={linkClass}>
            Back to sign in
          </Link>
        }
      >
        <Link href="/forgot-password" className="btn-primary w-full py-2.5">
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="You'll be signed out on your other devices.">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}

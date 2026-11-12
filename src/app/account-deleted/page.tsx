import Link from "next/link";
import { IconCheck } from "@/components/icons";
import { AuthCard, StatusIcon, linkClass } from "@/components/ui";

export const metadata = { title: "Account deleted" };

export default function AccountDeletedPage() {
  return (
    <AuthCard
      icon={
        <StatusIcon tone="success">
          <IconCheck size={22} />
        </StatusIcon>
      }
      title="Account deleted"
      subtitle="Your account and all of your data have been deleted, and you've been signed out on every device."
      footer={
        <Link href="/" className={linkClass}>
          Go to the SyncPads home page
        </Link>
      }
    >
      <Link href="/signup" className="btn-secondary w-full py-2.5">
        Create a new workspace
      </Link>
    </AuthCard>
  );
}

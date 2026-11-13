import { SessionKeepAlive } from "@/components/session-keep-alive";
import { StartPageLoader } from "@/components/start/start-page-loader";
import { requireSession } from "@/lib/session";
import { isAdmin } from "@/server/admin";

export default async function AppPage() {
  const { user } = await requireSession();

  return (
    <>
      <SessionKeepAlive />
      <StartPageLoader userId={user.id} email={user.email} admin={isAdmin(user)} />
    </>
  );
}

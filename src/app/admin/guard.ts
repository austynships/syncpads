import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin, isPeriod, type Period } from "@/server/admin";

/**
 * Every admin page calls this itself (the layout's check alone doesn't guard a
 * page's data). Non-admins get a plain 404, so the dashboard's existence isn't revealed.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session.user)) notFound();
  return session;
}

export async function readPeriod(searchParams: Promise<{ period?: string | string[] }>): Promise<Period> {
  const p = (await searchParams).period;
  return isPeriod(p) ? p : "week";
}

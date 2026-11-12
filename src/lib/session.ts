import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** Current session in a server component, or null. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Current session, or redirect to /login. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}


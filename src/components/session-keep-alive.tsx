"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Keeps the 30-day session rolling while the user is active.
 * Server components can read the session but can't update cookies, so this
 * calls /api/auth/get-session from the browser, which extends the session
 * (at most once a day) and refreshes the cookie.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    authClient.getSession();
  }, []);
  return null;
}


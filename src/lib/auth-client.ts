"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin client; the API lives at /api/auth.
export const authClient = createAuthClient();


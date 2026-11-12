/**
 * Better Auth server config (SP-1: email and password only).
 * No magic links, no social providers — just email + password.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getClientIp } from "./client-ip";
import { linkEmail, sendEmail } from "./email";
import { checkLockout, clearFailures, lockoutMessage, recordFailure } from "./lockout";
import { hashPassword, verifyPassword } from "./password";
import { redis } from "./redis";

const THIRTY_DAYS = 60 * 60 * 24 * 30;
const ONE_DAY = 60 * 60 * 24;

// Don't await email sends inside auth flows: response time would reveal
// whether an account exists. Log failures instead.
function sendInBackground(email: Parameters<typeof sendEmail>[0]) {
  sendEmail(email).catch((err) => console.error("[email] send failed:", err));
}

export const auth = betterAuth({
  appName: "SyncPads",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: "mysql",
    schema,
    usePlural: true, // models map to users, sessions, accounts, verifications
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: { hash: hashPassword, verify: verifyPassword }, // Argon2id
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      sendInBackground({
        to: user.email,
        subject: "Reset your SyncPads password",
        ...linkEmail({
          heading: "Reset your password",
          body: "Click the button below to choose a new password. This link expires in 1 hour.",
          buttonText: "Reset password",
          url,
        }),
      });
    },
    onPasswordReset: async ({ user }, request) => {
      await clearFailures(redis, user.email, getClientIp(request?.headers));
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true, // re-send if an unverified user tries to sign in
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendInBackground({
        to: user.email,
        subject: "Verify your SyncPads email",
        ...linkEmail({
          heading: "Welcome to SyncPads",
          body: "Confirm your email address to finish creating your account.",
          buttonText: "Verify email",
          url,
        }),
      });
    },
  },

  user: {
    additionalFields: {
      // input: false = can never be set from a client request (e.g. sign-up).
      plan: { type: "string", required: false, defaultValue: "free", input: false },
      stripeCustomerId: { type: "string", required: false, input: false },
    },
    // Immediate deletion; foreign keys cascade to every user-owned row.
    deleteUser: {
      enabled: true,
      // End any Pro subscription first, so a deleted account is never charged again.
      beforeDelete: async (user) => {
        const { cancelSubscriptionForDeletion } = await import("@/server/billing");
        await cancelSubscriptionForDeletion(user.id);
      },
    },
  },

  session: {
    expiresIn: THIRTY_DAYS, // 30-day sessions...
    updateAge: ONE_DAY, // ...pushed forward at most once a day while the user is active
  },

  // Sign-in lockout: 5 failures per email+IP, 20 per IP, both for 15 minutes.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = String(ctx.body?.email ?? "");
      const status = await checkLockout(redis, email, getClientIp(ctx.headers));
      if (status.locked) {
        throw new APIError("TOO_MANY_REQUESTS", {
          code: "ACCOUNT_LOCKED",
          message: lockoutMessage(status.retryAfterSeconds),
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = String(ctx.body?.email ?? "");
      const ip = getClientIp(ctx.headers);
      const returned = ctx.context.returned;

      // 401 = wrong password OR unknown email; Better Auth returns the same
      // generic error for both, and we count both the same way.
      if (returned instanceof APIError && returned.statusCode === 401) {
        await recordFailure(redis, email, ip);
      } else if (ctx.context.newSession) {
        await clearFailures(redis, email, ip);
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;


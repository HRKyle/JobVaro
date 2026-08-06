/**
 * Plan / subscription server functions.
 * All data access goes through server functions — never exposed to the client.
 */

import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlanInfo {
  plan: string;
  applicationCount: number;
  limit: number | null; // null = unlimited (Pro)
  isPro: boolean;
}

export interface PlanCheckResult {
  canCreate: boolean;
  currentCount: number;
  limit: number;
  isPro: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const FREE_LIMIT = 5;
export const PAID_COMPASS_MONTHLY_LIMIT = 25;
export const STRIPE_PRICE_IDS = {
  proMonthly: "price_1U1SOID0o28wel4T3OQ3s6CS",
  sprintPass: "price_1U1SOID0o28wel4TG8Cfafa8",
  momentumPass: "price_1U1SOID0o28wel4TjytSswKy",
  compassAddOn: "price_1U1SOID0o28wel4TW4cBSLvr",
} as const;

async function getUserId(): Promise<string | null> {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie("jobhub_session");
  if (!token) return null;

  const sess = await sql`
    SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
  `;
  if (sess.length === 0) return null;
  const { user_id, expires_at } = sess[0] as {
    user_id: string;
    expires_at: Date;
  };
  if (new Date(expires_at) < new Date()) return null;

  return user_id;
}

// ── getCurrentPlan ───────────────────────────────────────────────────────────

export const getCurrentPlan = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlanInfo | null> => {
    const userId = await getUserId();
    if (!userId) return null;

    try {
      const userRows = await sql`
        SELECT plan FROM users WHERE id = ${userId} LIMIT 1
      `;
      if (userRows.length === 0) return null;
      const plan = String((userRows[0] as { plan: string }).plan ?? "free");
      const isPro = ["pro", "sprint", "momentum"].includes(plan);

      const countRows = await sql`
        SELECT COUNT(*)::int AS count FROM applications WHERE user_id = ${userId}
      `;
      const applicationCount =
        (countRows[0] as { count: number }).count ?? 0;

      return {
        plan,
        applicationCount,
        limit: isPro ? null : FREE_LIMIT,
        isPro,
      };
    } catch (err) {
      console.error("getCurrentPlan error:", err);
      return null;
    }
  },
);

// ── checkApplicationLimit ────────────────────────────────────────────────────

export const checkApplicationLimit = createServerFn({
  method: "GET",
}).handler(async (): Promise<PlanCheckResult> => {
  const userId = await getUserId();
  if (!userId) {
    return { canCreate: false, currentCount: 0, limit: FREE_LIMIT, isPro: false };
  }

  try {
    const userRows = await sql`
      SELECT plan FROM users WHERE id = ${userId} LIMIT 1
    `;
    const plan = String(
      (userRows[0] as { plan: string } | undefined)?.plan ?? "free",
    );
    const isPro = ["pro", "sprint", "momentum"].includes(plan);

    const countRows = await sql`
      SELECT COUNT(*)::int AS count FROM applications WHERE user_id = ${userId}
    `;
    const currentCount =
      (countRows[0] as { count: number }).count ?? 0;

    return {
      canCreate: isPro || currentCount < FREE_LIMIT,
      currentCount,
      limit: FREE_LIMIT,
      isPro,
    };
  } catch (err) {
    console.error("checkApplicationLimit error:", err);
    return { canCreate: false, currentCount: 0, limit: FREE_LIMIT, isPro: false };
  }
});

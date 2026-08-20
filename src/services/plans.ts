/**
 * Plan / subscription server functions.
 * All data access goes through server functions — never exposed to the client.
 *
 * Plan model: every paid plan is a ONE-TIME purchase for a fixed term.
 * No plan auto-renews. Paid plans carry plan_expires_at; when that timestamp
 * passes the user reverts to Free. NULL plan_expires_at = never expires
 * (used by the giveaway demo accounts).
 */

import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import {
  sendLapseEmail,
  sendPreExpiryEmail,
} from "~/services/email";

// ── Types ────────────────────────────────────────────────────────────────────

export type PaidPlan = "pro" | "sprint" | "momentum";
export const PAID_PLANS = ["pro", "sprint", "momentum"] as const;

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

export interface ExpiryNotice {
  plan: string;
  planName: string;
  daysLeft: number;
  noticeDue: boolean;
  expiresAt: string;
}

// ── Plan constants ───────────────────────────────────────────────────────────

/** Fixed duration (days) of each one-time paid plan. No auto-renewal. */
export const PLAN_DURATION_DAYS = { pro: 30, sprint: 90, momentum: 180 } as const;

/** Grace period (days) after a paid plan lapses before over-limit data is deleted. */
export const GRACE_PERIOD_DAYS = 30;

/** Display labels for paid plans. */
export const PLAN_LABELS: Record<PaidPlan, string> = {
  pro: "Pro",
  sprint: "Sprint Pass",
  momentum: "Momentum Pass",
};

/** Human duration label, e.g. "1 month" / "3 months" / "6 months". */
export function planDurationLabel(plan: PaidPlan): string {
  const months = PLAN_DURATION_DAYS[plan] / 30;
  return `${months} month${months > 1 ? "s" : ""}`;
}

/** Expiry-notice thresholds (days before expiry) — each fires once, in order 7 → 5 → 3 → 1. */
export const NOTICE_DAYS = [7, 5, 3, 1] as const;

/**
 * Canonical expiry-notice copy. {planName} and {days} are placeholders filled
 * by fillExpiryNoticeCopy(). Kept in ONE exported constant so the email channel
 * reuses the exact owner-dictated wording.
 */
export const EXPIRY_NOTICE_COPY =
  "Your {planName} is a fixed-term, one-time purchase and does not auto-renew — nothing is ever charged again. It ends in {days} day(s). To keep Pro, you must actively renew before it ends; otherwise your plan reverts to Free, and any applications or analyses beyond free limits will be locked for 30 days and then permanently deleted.";

export function fillExpiryNoticeCopy(planName: string, days: number): string {
  return EXPIRY_NOTICE_COPY.replace("{planName}", planName).replace(
    "{days}",
    String(days),
  );
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

export function isPaidPlan(plan: string): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(plan);
}

/** Whole days until an expiry timestamp, rounding UP: 6.5 days left = 7. */
export function daysUntilExpiry(expiresAt: Date | string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Expiry date of a user's paid plan, or null when there is none. */
export function getPlanExpiry(user: {
  plan: string;
  plan_expires_at?: Date | string | null;
}): Date | null {
  if (!isPaidPlan(user.plan)) return null;
  if (user.plan_expires_at === null || user.plan_expires_at === undefined) {
    return null; // NULL expiry = never expires (active indefinitely)
  }
  return new Date(user.plan_expires_at);
}

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

interface EffectivePlan {
  plan: string;
  isPro: boolean;
}

/**
 * Resolve a user's effective plan.
 * A paid plan with a non-null expiry that has PASSED is immediately reverted
 * to Free (plan='free', plan_expires_at=NULL) and treated as free for the
 * rest of this request. NULL expiry = paid plan active indefinitely.
 *
 * Lapse also STARTS the 30-day grace period: grace_ends_at is set to
 * now() + GRACE_PERIOD_DAYS the first time the lapse is observed (set once —
 * never extended on later requests). Users who have already finished grace
 * (grace_ends_at in the past) are left for the deletion sweep to clean up.
 */
async function resolveEffectivePlan(userId: string): Promise<EffectivePlan> {
  const userRows = await sql`
    SELECT plan, plan_expires_at FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (userRows.length === 0) return { plan: "free", isPro: false };

  const row = userRows[0] as {
    plan: string;
    plan_expires_at: Date | string | null;
  };
  let plan = String(row.plan ?? "free");

  if (
    isPaidPlan(plan) &&
    row.plan_expires_at !== null &&
    row.plan_expires_at !== undefined &&
    new Date(row.plan_expires_at) < new Date()
  ) {
    await sql`
      UPDATE users
      SET plan = 'free',
          plan_expires_at = NULL,
          grace_ends_at = COALESCE(
            grace_ends_at,
            now() + (${GRACE_PERIOD_DAYS} * interval '1 day')
          )
      WHERE id = ${userId}
    `;
    plan = "free";
  }

  return { plan, isPro: isPaidPlan(plan) };
}

// ── Grace period (data-lapse policy, Option A) ──────────────────────────────
// When a paid plan lapses the user reverts to Free and gets a 30-day grace
// period. Data beyond the free limits is LOCKED (kept in the DB but hidden at
// query level); renewing within grace restores everything; when grace expires
// the deletion sweep permanently removes the over-limit rows.

export interface GraceState {
  inGrace: boolean;
  graceEndsAt: Date | null;
}

/** True when a user row is free (or not on a paid plan) with a grace period still running. */
export function isInGrace(user: {
  plan?: string | null;
  grace_ends_at?: Date | string | null;
}): boolean {
  const plan = String(user.plan ?? "free");
  if (isPaidPlan(plan)) return false;
  const g = user.grace_ends_at;
  if (g === null || g === undefined) return false;
  return new Date(g).getTime() > Date.now();
}

/**
 * Fetch a user's current grace state. Does NOT mutate. Free + future
 * grace_ends_at = in grace.
 */
export async function getGraceStateForUser(userId: string): Promise<GraceState> {
  const rows = await sql`
    SELECT plan, grace_ends_at FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (rows.length === 0) return { inGrace: false, graceEndsAt: null };
  const row = rows[0] as { plan: string; grace_ends_at: Date | string | null };
  return {
    inGrace: isInGrace(row),
    graceEndsAt: row.grace_ends_at ? new Date(row.grace_ends_at) : null,
  };
}

/**
 * Number of applications beyond the free limit of 5 (i.e. all but the 5 most
 * recently created). 0 for users within the limit.
 */
export async function lockedApplicationCount(userId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM applications
    WHERE user_id = ${userId}
      AND id NOT IN (
        SELECT id FROM applications
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${FREE_LIMIT}
      )
  `;
  return (rows[0] as { count: number }).count ?? 0;
}

/**
 * Number of Compass analyses beyond the free limit of 1 (i.e. all but the
 * newest). 0 for users within the limit.
 */
export async function lockedAnalysisCount(userId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM compass_analyses
    WHERE user_id = ${userId}
      AND id NOT IN (
        SELECT id FROM compass_analyses
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      )
  `;
  return (rows[0] as { count: number }).count ?? 0;
}

// ── grantPaidPlan / setPaidPlan ──────────────────────────────────────────────
// grantPaidPlan is the canonical way to grant a paid plan for its fixed term.
// setPaidPlan (the RPC surface) and the Stripe fulfillment webhook both call it,
// so every grant path shares identical semantics: set plan + fixed expiry via
// PLAN_DURATION_DAYS, clear the grace period and its notice level (renewal
// restores everything — nothing is deleted during grace), and reset the
// expiry-notice level for the new term.

export async function grantPaidPlan(
  userId: string,
  plan: PaidPlan,
): Promise<boolean> {
  if (!isPaidPlan(plan)) return false;

  try {
    await sql`
      UPDATE users
      SET plan = ${plan},
          plan_expires_at = now() + (${PLAN_DURATION_DAYS[plan]} * interval '1 day'),
          expiry_notice_level = 0,
          grace_ends_at = NULL,
          grace_notice_level = 0
      WHERE id = ${userId}
    `;
    return true;
  } catch (err) {
    console.error("grantPaidPlan error:", err);
    return false;
  }
}

export const setPaidPlan = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<{ ok: boolean }> => {
    const { userId, plan } = data as { userId: string; plan: PaidPlan };
    return { ok: await grantPaidPlan(userId, plan) };
  },
);

// ── getCurrentPlan ───────────────────────────────────────────────────────────

export const getCurrentPlan = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlanInfo | null> => {
    const userId = await getUserId();
    if (!userId) return null;

    try {
      const { plan, isPro } = await resolveEffectivePlan(userId);

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
    const { isPro } = await resolveEffectivePlan(userId);

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

// ── Expiry notice engine ─────────────────────────────────────────────────────
// Notices fire at exactly 7 / 5 / 3 / 1 days before expiry (ceil'd). Each
// threshold fires once per plan term thanks to expiry_notice_level.

export const getExpiryNotice = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExpiryNotice | null> => {
    const userId = await getUserId();
    if (!userId) return null;

    try {
      const userRows = await sql`
        SELECT plan, plan_expires_at, expiry_notice_level, email
        FROM users WHERE id = ${userId} LIMIT 1
      `;
      if (userRows.length === 0) return null;

      const row = userRows[0] as {
        plan: string;
        plan_expires_at: Date | string | null;
        expiry_notice_level: number | null;
        email: string;
      };
      const plan = String(row.plan ?? "free");
      const expiresAt = row.plan_expires_at ?? null;

      // Free users and paid users without an expiry get no notice.
      if (!isPaidPlan(plan) || expiresAt === null) return null;

      const daysLeft = daysUntilExpiry(expiresAt);
      const level = Number(row.expiry_notice_level ?? 0);
      const noticeDue =
        (NOTICE_DAYS as readonly number[]).includes(daysLeft) &&
        level < daysLeft;

      // On-access safety net: when a notice is due, fire the same email the
      // sweep would send (fire-and-forget — never block the page). Dedup is
      // shared with the in-app banner via expiry_notice_level: whichever
      // channel delivers first marks the level; the other sees it marked.
      if (noticeDue) {
        const planName = PLAN_LABELS[plan as PaidPlan];
        const copy = fillExpiryNoticeCopy(planName, daysLeft);
        void sendPreExpiryEmail({
          userId,
          to: String(row.email),
          planName,
          daysLeft,
          expiresAt,
          copy,
        }).catch((err: unknown) => {
          console.error(
            "on-access expiry email failed:",
            err instanceof Error ? err.message : err,
          );
        });
      }

      return {
        plan,
        planName: PLAN_LABELS[plan as PaidPlan],
        daysLeft,
        noticeDue,
        expiresAt: new Date(expiresAt).toISOString(),
      };
    } catch (err) {
      console.error("getExpiryNotice error:", err);
      return null;
    }
  },
);

export interface GraceNotice {
  inGrace: boolean;
  graceEndsAt: string | null;
  lockedApplications: number;
  lockedAnalyses: number;
}

/**
 * Grace-period status for the logged-in user, used by the in-app grace banner.
 * Also starts grace on-access (via resolveEffectivePlan) if the plan just
 * lapsed, and fires the lapse-day email once (deduped by grace_notice_level)
 * for users who visit between sweeps.
 */
export const getGraceStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<GraceNotice | null> => {
    const userId = await getUserId();
    if (!userId) return null;

    try {
      // Revert + start grace on-access if the plan lapsed.
      await resolveEffectivePlan(userId);

      const userRows = await sql`
        SELECT plan, grace_ends_at, grace_notice_level, email
        FROM users WHERE id = ${userId} LIMIT 1
      `;
      if (userRows.length === 0) return null;

      const row = userRows[0] as {
        plan: string;
        grace_ends_at: Date | string | null;
        grace_notice_level: number | null;
        email: string;
      };
      if (!isInGrace(row)) return { inGrace: false, graceEndsAt: null, lockedApplications: 0, lockedAnalyses: 0 };

      const graceEndsAt = new Date(row.grace_ends_at as Date | string);

      // On-access lapse email (fire-and-forget, deduped by grace_notice_level).
      if (Number(row.grace_notice_level ?? 0) < 1) {
        void sendLapseEmail({
          userId,
          to: String(row.email),
          planName: "paid plan",
          graceEndsAt,
        }).catch((err: unknown) => {
          console.error(
            "on-access lapse email failed:",
            err instanceof Error ? err.message : err,
          );
        });
      }

      const [lockedApplications, lockedAnalyses] = await Promise.all([
        lockedApplicationCount(userId),
        lockedAnalysisCount(userId),
      ]);

      return {
        inGrace: true,
        graceEndsAt: graceEndsAt.toISOString(),
        lockedApplications,
        lockedAnalyses,
      };
    } catch (err) {
      console.error("getGraceStatus error:", err);
      return null;
    }
  },
);

export const markExpiryNoticeSent = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<{ ok: boolean }> => {
    const userId = await getUserId();
    if (!userId) return { ok: false };

    const level = Number((data as { level?: number }).level ?? 0);
    try {
      await sql`
        UPDATE users
        SET expiry_notice_level = GREATEST(COALESCE(expiry_notice_level, 0), ${level})
        WHERE id = ${userId}
      `;
      return { ok: true };
    } catch (err) {
      console.error("markExpiryNoticeSent error:", err);
      return { ok: false };
    }
  },
);

/**
 * Lapse sweep — the server-side heartbeat for the data-lapse policy (Option A).
 * Runs once at server boot and every 30 minutes from serve.ts.
 *
 * Steps (each bounded, errors logged and swallowed — never crash the server):
 *  1. Paid users whose plan_expires_at passed → revert to Free, start the
 *     30-day grace period (set once), and send the lapse-day email
 *     (grace_notice_level < 1 → send + mark 1).
 *  2. Users whose grace period has ended → permanently DELETE over-limit data
 *     (applications beyond the 5 newest + their events; analyses beyond the
 *     newest 1) and clear grace_ends_at.
 *  3. Users in grace with ≤ 7 days left → send the final-warning email
 *     (grace_notice_level < 2 → send + mark 2).
 *  4. Paid users with a notice threshold due (7/5/3/1 days) → send the
 *     pre-expiry email and mark expiry_notice_level (shared with the in-app
 *     banner for dedup).
 */

import { sql } from "~/db";
import {
  GRACE_PERIOD_DAYS,
  NOTICE_DAYS,
  PLAN_LABELS,
  daysUntilExpiry,
  fillExpiryNoticeCopy,
  type PaidPlan,
} from "~/services/plans";
import {
  sendFinalWarningEmail,
  sendLapseEmail,
  sendPreExpiryEmail,
} from "~/services/email";

const SWEEP_BATCH = 100;

function logStepError(step: string, err: unknown): void {
  console.error(
    `lapse sweep [${step}] error:`,
    err instanceof Error ? err.message : err,
  );
}

async function sweepLapsedPlans(): Promise<void> {
  // Paid plan whose expiry has passed → revert to free + start grace once.
  const rows = await sql`
    SELECT id, email, plan, plan_expires_at
    FROM users
    WHERE plan IN ('pro', 'sprint', 'momentum')
      AND plan_expires_at IS NOT NULL
      AND plan_expires_at < now()
    LIMIT ${SWEEP_BATCH}
  `;
  for (const raw of rows as Record<string, unknown>[]) {
    const user = raw as { id: string; email: string; plan: string };
    const updated = await sql`
      UPDATE users
      SET plan = 'free',
          plan_expires_at = NULL,
          grace_ends_at = COALESCE(
            grace_ends_at,
            now() + (${GRACE_PERIOD_DAYS} * interval '1 day')
          )
      WHERE id = ${user.id}
      RETURNING grace_ends_at, grace_notice_level
    `;
    const res = updated[0] as {
      grace_ends_at: Date | string;
      grace_notice_level: number | null;
    } | undefined;
    if (!res) continue;
    // Lapse-day email, deduped by grace_notice_level.
    if (Number(res.grace_notice_level ?? 0) < 1) {
      await sendLapseEmail({
        userId: user.id,
        to: user.email,
        planName: (PLAN_LABELS[user.plan as PaidPlan] ?? "paid plan") as string,
        graceEndsAt: res.grace_ends_at,
      });
    }
  }
}

async function sweepExpiredGrace(): Promise<void> {
  // Grace period over → permanently delete over-limit rows, then clear grace.
  const rows = await sql`
    SELECT id FROM users
    WHERE grace_ends_at IS NOT NULL AND grace_ends_at < now()
    LIMIT ${SWEEP_BATCH}
  `;
  for (const raw of rows as Record<string, unknown>[]) {
    const userId = String((raw as { id: string }).id);
    // Events of locked applications first (FK), then the applications, then
    // locked analyses. The 5 newest applications and newest 1 analysis survive.
    await sql`
      DELETE FROM application_events
      WHERE application_id IN (
        SELECT id FROM applications
        WHERE user_id = ${userId}
          AND id NOT IN (
            SELECT id FROM applications
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
            LIMIT 5
          )
      )
    `;
    await sql`
      DELETE FROM applications
      WHERE user_id = ${userId}
        AND id NOT IN (
          SELECT id FROM applications
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 5
        )
    `;
    await sql`
      DELETE FROM compass_analyses
      WHERE user_id = ${userId}
        AND id NOT IN (
          SELECT id FROM compass_analyses
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 1
        )
    `;
    await sql`
      UPDATE users SET grace_ends_at = NULL WHERE id = ${userId}
    `;
    console.log(
      `lapse sweep: grace ended, deleted over-limit data for user ${userId}`,
    );
  }
}

async function sweepFinalWarnings(): Promise<void> {
  // In grace with ≤ 7 days left → final-warning email once (level 2).
  const rows = await sql`
    SELECT id, email, grace_ends_at, grace_notice_level
    FROM users
    WHERE grace_ends_at IS NOT NULL
      AND grace_ends_at > now()
      AND grace_ends_at < now() + interval '7 days'
      AND grace_notice_level < 2
    LIMIT ${SWEEP_BATCH}
  `;
  for (const raw of rows as Record<string, unknown>[]) {
    const user = raw as {
      id: string;
      email: string;
      grace_ends_at: Date | string;
      grace_notice_level: number | null;
    };
    if (Number(user.grace_notice_level ?? 0) < 2) {
      await sendFinalWarningEmail({
        userId: user.id,
        to: user.email,
        planName: "paid plan",
        deletionDate: user.grace_ends_at,
      });
    }
  }
}

async function sweepPreExpiryEmails(): Promise<void> {
  // Paid plans with a notice threshold due (7/5/3/1 days before expiry).
  const rows = await sql`
    SELECT id, email, plan, plan_expires_at, expiry_notice_level
    FROM users
    WHERE plan IN ('pro', 'sprint', 'momentum')
      AND plan_expires_at IS NOT NULL
      AND plan_expires_at > now()
      AND expiry_notice_level < 7
    LIMIT ${SWEEP_BATCH * 2}
  `;
  for (const raw of rows as Record<string, unknown>[]) {
    const user = raw as {
      id: string;
      email: string;
      plan: string;
      plan_expires_at: Date | string;
      expiry_notice_level: number | null;
    };
    const daysLeft = daysUntilExpiry(user.plan_expires_at);
    const level = Number(user.expiry_notice_level ?? 0);
    if (
      (NOTICE_DAYS as readonly number[]).includes(daysLeft) &&
      level < daysLeft
    ) {
      const planName = (PLAN_LABELS[user.plan as PaidPlan] ?? "paid plan") as string;
      await sendPreExpiryEmail({
        userId: user.id,
        to: user.email,
        planName,
        daysLeft,
        expiresAt: user.plan_expires_at,
        copy: fillExpiryNoticeCopy(planName, daysLeft),
      });
    }
  }
}

/**
 * Run one full lapse sweep. Never throws — every step is isolated in its own
 * try/catch so a failure in one step can't kill the server or the other steps.
 */
export async function runLapseSweep(): Promise<void> {
  try {
    await sweepLapsedPlans();
  } catch (err) {
    logStepError("lapsed-plans", err);
  }
  try {
    await sweepExpiredGrace();
  } catch (err) {
    logStepError("expired-grace", err);
  }
  try {
    await sweepFinalWarnings();
  } catch (err) {
    logStepError("final-warnings", err);
  }
  try {
    await sweepPreExpiryEmails();
  } catch (err) {
    logStepError("pre-expiry-emails", err);
  }
}

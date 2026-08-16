/**
 * Email reminders (Resend) — pre-expiry, lapse-day, and final-warning emails
 * for the data-lapse policy (Option A).
 *
 * sendEmail() POSTs to Resend. When RESEND_API_KEY is missing (dev / pre-Secrets)
 * it logs "[email would send] ..." instead and never throws, so everything is
 * testable before the owner supplies the key. The notify* helpers below send AND
 * mark the dedup level (expiry_notice_level / grace_notice_level) — marking is
 * shared with the in-app banner channel so each threshold fires exactly once
 * regardless of which channel delivered it. The API key is never logged.
 */

import { sql } from "~/db";

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "JobVaro <onboarding@resend.dev>";
const RENEW_URL = "https://www.jobvaro.com/plans";

// ── Transient-error retry (duplicate of the small helper in src/db.ts) ───────

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // fetch() throws TypeError on network failures; Resend 5xx are transient too.
  return (
    err.name === "TimeoutError" ||
    err.name === "AbortError" ||
    err.message.includes("fetch failed") ||
    err.message.includes("network") ||
    err.message.includes("ECONN")
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST an email to Resend. Retries transient network errors (2 retries, short
 * backoff), like withRetry in src/db.ts. 4xx responses are not retried.
 * Never throws — dev mode (no key) logs the would-be send instead.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[email would send] to=${to} subject="${subject}" (RESEND_API_KEY not set)`,
    );
    return;
  }

  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
  const body = JSON.stringify({ from, to, subject, html });

  const backoffs = [250, 800];
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body,
      });
    } catch (err) {
      if (!isTransientNetworkError(err) || attempt >= backoffs.length) {
        console.error(
          "email send failed (network):",
          err instanceof Error ? err.message : err,
        );
        return;
      }
      await sleep(backoffs[attempt] as number);
      continue;
    }

    if (res.ok) return;
    // 5xx = transient server-side error, retry; 4xx = bad payload, don't retry.
    if (res.status >= 500 && res.status < 600 && attempt < backoffs.length) {
      await sleep(backoffs[attempt] as number);
      continue;
    }
    console.error(`email send failed: Resend HTTP ${res.status}`);
    return;
  }
}

// ── HTML template ────────────────────────────────────────────────────────────

function emailHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.02em;">JobVaro</span>
                <span style="color:#c7d2fe;font-size:12px;font-weight:600;margin-left:8px;">by HRKyle</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#27272a;font-size:15px;line-height:1.6;">
                ${bodyHtml}
                <p style="margin:28px 0 0 0;text-align:center;">
                  <a href="${RENEW_URL}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;">Renew now</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #f0f0f2;color:#71717a;font-size:12px;line-height:1.5;">
                You're receiving this because you have a JobVaro plan with an upcoming or lapsed expiration.<br />
                Questions? Reply to this email and we'll help. · <a href="https://www.jobvaro.com/plans" style="color:#4f46e5;">JobVaro plans</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Pre-expiry (T-7 / T-5 / T-3 / T-1) ───────────────────────────────────────

/**
 * Send the pre-expiry reminder for a threshold and mark expiry_notice_level so
 * neither the sweep nor the in-app banner re-delivers this threshold.
 */
export async function sendPreExpiryEmail({
  userId,
  to,
  planName,
  daysLeft,
  expiresAt,
  copy,
}: {
  userId: string;
  to: string;
  planName: string;
  daysLeft: number;
  expiresAt: Date | string;
  copy: string; // fillExpiryNoticeCopy(planName, daysLeft) — policy copy
}): Promise<void> {
  const subject = `Your ${planName} ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — renew to keep your data`;
  const html = emailHtml(
    `<p>Hi there,</p>
     <p>${copy}</p>
     <p>Your <strong>${planName}</strong> access ends on <strong>${formatDate(expiresAt)}</strong> (${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining). Renew before it ends to keep unlimited tracking and Compass.</p>`,
  );
  await sendEmail({ to, subject, html });
  try {
    await sql`
      UPDATE users
      SET expiry_notice_level = GREATEST(COALESCE(expiry_notice_level, 0), ${daysLeft})
      WHERE id = ${userId}
    `;
  } catch (err) {
    console.error("sendPreExpiryEmail mark error:", err);
  }
}

// ── Lapse day (T-0) ──────────────────────────────────────────────────────────

/**
 * Send the lapse-day email and mark grace_notice_level = 1.
 */
export async function sendLapseEmail({
  userId,
  to,
  planName,
  graceEndsAt,
}: {
  userId: string;
  to: string;
  planName: string;
  graceEndsAt: Date | string;
}): Promise<void> {
  const subject = `Your ${planName} has ended — renew within 30 days to keep your data`;
  const html = emailHtml(
    `<p>Hi there,</p>
     <p>Your <strong>${planName}</strong> has ended and you're now on the Free plan. Applications or analyses beyond the free limits are <strong>locked</strong> — they're safe for now, but hidden.</p>
     <p>Renew within 30 days (by <strong>${formatDate(graceEndsAt)}</strong>) to restore everything instantly. After that date, locked data is permanently deleted.</p>`,
  );
  await sendEmail({ to, subject, html });
  try {
    await sql`
      UPDATE users
      SET grace_notice_level = GREATEST(COALESCE(grace_notice_level, 0), 1)
      WHERE id = ${userId}
    `;
  } catch (err) {
    console.error("sendLapseEmail mark error:", err);
  }
}

// ── Final warning (T+23, 7 days before deletion) ─────────────────────────────

/**
 * Send the final-warning email and mark grace_notice_level = 2.
 */
export async function sendFinalWarningEmail({
  userId,
  to,
  planName,
  deletionDate,
}: {
  userId: string;
  to: string;
  planName: string;
  deletionDate: Date | string;
}): Promise<void> {
  const subject = `7 days left — your locked JobVaro data will be permanently deleted`;
  const html = emailHtml(
    `<p>Hi there,</p>
     <p><strong>7 days left.</strong> Your locked data will be <strong>permanently deleted</strong> on <strong>${formatDate(deletionDate)}</strong>.</p>
     <p>Renew now to keep everything — once deleted, it can't be recovered.</p>`,
  );
  await sendEmail({ to, subject, html });
  try {
    await sql`
      UPDATE users
      SET grace_notice_level = GREATEST(COALESCE(grace_notice_level, 0), 2)
      WHERE id = ${userId}
    `;
  } catch (err) {
    console.error("sendFinalWarningEmail mark error:", err);
  }
}

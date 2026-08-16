/**
 * Stripe purchase fulfillment — checkouts, webhook, and upgrade verification.
 *
 * Uses the OWNER'S OWN Stripe account via environment secrets (never hardcoded,
 * never logged):
 *   STRIPE_SECRET_KEY       — api.stripe.com bearer token (test or live)
 *   STRIPE_WEBHOOK_SECRET   — signing secret for /api/stripe-webhook events
 *
 * When either key is absent the app degrades gracefully: the buy CTAs render a
 * "Payments not configured yet" state, checkout creation returns a friendly
 * error, and the webhook answers 503 so Stripe keeps retrying once configured.
 */

import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { isPaidPlan, type PaidPlan } from "~/services/plans";

// ── Config ───────────────────────────────────────────────────────────────────

const STRIPE_API_BASE = "https://api.stripe.com";
const CHECKOUT_SUCCESS_URL =
  "https://www.jobvaro.com/upgrade-success?session_id={CHECKOUT_SESSION_ID}";
const CHECKOUT_CANCEL_URL = "https://www.jobvaro.com/plans";

/** One-time amounts (cents) + product names for each plan. No pre-created price. */
export const PLAN_PRICES: Record<PaidPlan, { amount: number; name: string }> = {
  pro: { amount: 1495, name: "JobVaro Pro" },
  sprint: { amount: 2995, name: "JobVaro Sprint Pass" },
  momentum: { amount: 4495, name: "JobVaro Momentum Pass" },
};

export function stripeSecretKey(): string | null {
  const k = process.env.STRIPE_SECRET_KEY;
  return k && k.trim().length > 0 ? k.trim() : null;
}

export function stripeWebhookSecret(): string | null {
  const k = process.env.STRIPE_WEBHOOK_SECRET;
  return k && k.trim().length > 0 ? k.trim() : null;
}

/** True only when the app is fully wired to Stripe (secret + webhook secret). */
export function isStripeConfigured(): boolean {
  return stripeSecretKey() !== null && stripeWebhookSecret() !== null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  try {
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
  } catch {
    return null;
  }
}

function formEncode(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
}

async function stripeFetch(
  path: string,
  init: { method: string; body?: string; headers?: Record<string, string> },
): Promise<{ status: number; json: any } | null> {
  const key = stripeSecretKey();
  if (!key) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${STRIPE_API_BASE}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${key}`,
          ...(init.headers ?? {}),
        },
        body: init.body,
        signal: controller.signal,
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { status: res.status, json };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error(
      "Stripe API request failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── Public status (for the UI) ───────────────────────────────────────────────

export const getStripeStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ configured: boolean }> => {
    return { configured: isStripeConfigured() };
  },
);

// ── createCheckoutSession ────────────────────────────────────────────────────
// Server fn: create a Stripe Checkout Session for a one-time plan purchase and
// return the hosted checkout URL. The client redirects there.

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export const createCheckoutSession = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<CheckoutResult> => {
    const plan = String((data as { plan?: string }).plan ?? "");
    if (!isPaidPlan(plan)) {
      return { ok: false, error: "Unknown plan." };
    }

    const key = stripeSecretKey();
    if (!key) {
      return { ok: false, error: "Payments not configured yet." };
    }

    // Must be a logged-in user so we can attach their email to the session.
    const userId = await getCurrentUserId();
    if (!userId) {
      return { ok: false, error: "Please log in to upgrade." };
    }

    const userRows = await sql`
      SELECT email FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (userRows.length === 0) {
      return { ok: false, error: "Please log in to upgrade." };
    }
    const email = String((userRows[0] as { email: string }).email);

    const { amount, name } = PLAN_PRICES[plan];
    const body = formEncode({
      mode: "payment",
      "success_url": CHECKOUT_SUCCESS_URL,
      "cancel_url": CHECKOUT_CANCEL_URL,
      "customer_email": email,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": amount,
      "line_items[0][price_data][product_data][name]": name,
      "metadata[user_id]": userId,
      "metadata[email]": email,
      "metadata[plan]": plan,
    });

    const res = await stripeFetch("/v1/checkout/sessions", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!res) {
      return { ok: false, error: "Payments are temporarily unavailable." };
    }
    if (res.status !== 200 || !res.json?.url) {
      console.error(
        `createCheckoutSession: Stripe returned ${String(res.status)}`,
      );
      return {
        ok: false,
        error:
          res.status === 401 || res.status === 403
            ? "Payments not configured yet."
            : "Couldn't start checkout. Please try again.",
      };
    }

    return { ok: true, url: String(res.json.url) };
  },
);

// ── verifyUpgrade ────────────────────────────────────────────────────────────
// Server-verifies a checkout session (payment_status + plan metadata) and — only
// once the webhook has actually landed (plan + expiry visible in the DB) —
// reports "active". Success is never shown before it's true.

export type UpgradeVerifyResult =
  | { status: "no-session" }
  | { status: "not-configured" }
  | { status: "invalid" }
  | { status: "not-paid" }
  | { status: "pending" }
  | { status: "active"; plan: string; expiresAt: string };

export const verifyUpgrade = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<UpgradeVerifyResult> => {
    const sessionId = String((data as { sessionId?: string }).sessionId ?? "");
    if (!sessionId) return { status: "no-session" };
    if (!stripeSecretKey()) return { status: "not-configured" };

    const res = await stripeFetch(
      `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { method: "GET" },
    );
    if (!res || res.status !== 200 || !res.json) return { status: "invalid" };

    const session = res.json;
    const plan = String(session.metadata?.plan ?? "");
    if (!isPaidPlan(plan)) return { status: "invalid" };
    if (session.payment_status !== "paid") return { status: "not-paid" };

    // Payment confirmed — but only show success once the webhook has granted
    // the plan in our DB (it lands within seconds; poll until then).
    const email = String(
      session.metadata?.email ?? session.customer_email ?? "",
    )
      .trim()
      .toLowerCase();
    if (!email) return { status: "pending" };

    const rows = await sql`
      SELECT plan, plan_expires_at FROM users WHERE lower(email) = ${email} LIMIT 1
    `;
    if (rows.length === 0) return { status: "pending" };

    const row = rows[0] as {
      plan: string;
      plan_expires_at: Date | string | null;
    };
    const granted =
      isPaidPlan(String(row.plan)) &&
      row.plan_expires_at !== null &&
      new Date(row.plan_expires_at).getTime() > Date.now();
    if (!granted) return { status: "pending" };

    return {
      status: "active",
      plan: String(row.plan),
      expiresAt: new Date(row.plan_expires_at as Date | string).toISOString(),
    };
  },
);

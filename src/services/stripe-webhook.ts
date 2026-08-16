/**
 * Stripe webhook — server-only module. Never imported by client code, so it can
 * use node:crypto freely. Mounted at /api/stripe-webhook from serve.ts.
 *
 * Reads the RAW body (no parsing before the signature check), verifies the
 * Stripe signature (constructEvent logic replicated by hand — the stripe npm
 * package is not a dependency), dedupes by event id so retries never
 * double-grant, and fulfills checkout.session.completed via grantPaidPlan.
 * Never throws; always returns a Response quickly.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "~/db";
import { grantPaidPlan, isPaidPlan } from "~/services/plans";
import { stripeWebhookSecret } from "~/services/stripe";

// ── Signature verification ───────────────────────────────────────────────────
// The header carries `t=<unix-seconds>,v1=<hmac-hex>` and the expected
// signature is HMAC-SHA256(webhookSecret, "<t>.<rawPayload>") in hex.

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header || !secret) return false;
  if (payload.length === 0) return false;

  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === "t") timestamp = value;
    else if (key === "v1" && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  // Stripe's default tolerance is 300s — reject replayed/stale events.
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, "utf8");
    return (
      sigBuf.length === expectedBuf.length &&
      timingSafeEqual(sigBuf, expectedBuf)
    );
  });
}

// ── Webhook handler ──────────────────────────────────────────────────────────

const seenEventIds = new Set<string>();
const MAX_SEEN_EVENTS = 20_000;

export async function handleStripeWebhook(req: Request): Promise<Response> {
  // The public contract: non-POST is a 404 (documented in the brief).
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const secret = stripeWebhookSecret();
  if (!secret) {
    return new Response(
      JSON.stringify({ error: "Webhook not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // RAW body — signature check happens before any parsing.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!verifyStripeSignature(rawBody, signature, secret)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventId = String(event?.id ?? "");
  if (eventId && seenEventIds.has(eventId)) {
    // Stripe retry — already fulfilled; acknowledge without re-granting.
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }
  if (eventId) {
    seenEventIds.add(eventId);
    if (seenEventIds.size > MAX_SEEN_EVENTS) seenEventIds.clear();
  }

  try {
    if (event?.type === "checkout.session.completed") {
      const session = event.data?.object ?? {};
      const plan = String(session.metadata?.plan ?? "");
      const email = String(
        session.metadata?.email ?? session.customer_email ?? "",
      ).trim();

      if (isPaidPlan(plan) && email) {
        const rows = await sql`
          SELECT id FROM users WHERE lower(email) = lower(${email}) LIMIT 1
        `;
        if (rows.length > 0) {
          const userId = String((rows[0] as { id: string }).id);
          await grantPaidPlan(userId, plan);
        } else {
          // Checkout was created by a logged-in user, so this is unexpected —
          // log it but still ack (Stripe would otherwise retry forever).
          console.error(
            `stripe-webhook: checkout completed for unknown email ${email.slice(0, 3)}…`,
          );
        }
      }
    }
    // All other event types are acknowledged and ignored.
  } catch (err) {
    console.error(
      "stripe-webhook handler error:",
      err instanceof Error ? err.message : err,
    );
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

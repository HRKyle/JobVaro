/**
 * Stripe checkout redirect route.
 * Redirects to the Stripe payment link for Pro subscription.
 *
 * Update STRIPE_PAYMENT_LINK when the actual Stripe payment link is created:
 *   1. Create a Product + Price in the Stripe Dashboard
 *   2. Create a Payment Link for that Price
 *   3. Replace the placeholder below with the actual payment link URL
 */

import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

// ── Configurable Stripe payment link ─────────────────────────────────────────
const STRIPE_PAYMENT_LINK =
  "https://buy.stripe.com/14A4gyeTh3YE2X9fkZ9MY00";

const getRedirectUrl = createServerFn({ method: "GET" }).handler(async () => {
  return { url: STRIPE_PAYMENT_LINK };
});

export const Route = createFileRoute("/stripe-checkout")({
  loader: async () => {
    const { url } = await getRedirectUrl();
    return { redirectUrl: url };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        "http-equiv": "refresh" as const,
        content: `0;url=${String(loaderData?.redirectUrl ?? STRIPE_PAYMENT_LINK)}`,
      },
    ],
  }),
  component: StripeCheckoutPage,
});

function StripeCheckoutPage() {
  const { redirectUrl } = Route.useLoaderData();

  useEffect(() => {
    window.location.href = redirectUrl;
  }, [redirectUrl]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Redirecting to checkout…
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        You'll be redirected to Stripe to complete your Pro subscription.
      </p>
      <a
        href={redirectUrl}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Continue to checkout
      </a>
    </main>
  );
}

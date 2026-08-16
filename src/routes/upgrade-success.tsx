import { createFileRoute, Link } from "@tanstack/react-router";
import { getCurrentUser } from "~/auth/functions";
import {
  getCurrentPlan,
  PLAN_LABELS,
  type PaidPlan,
} from "~/services/plans";
import { verifyUpgrade, type UpgradeVerifyResult } from "~/services/stripe";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/upgrade-success")({
  loader: async () => {
    const [userResult, planInfo] = await Promise.all([
      getCurrentUser(),
      getCurrentPlan(),
    ]);
    return { user: userResult.user, planInfo };
  },
  component: UpgradeSuccessPage,
});

const MAX_POLLS = 10; // ~20s of 2s polls — the webhook lands within seconds
const POLL_INTERVAL_MS = 2000;

const proFeatureList = [
  "Unlimited tracked applications",
  "25 Compass analyses per month (then $0.99 each)",
  "Priority support",
];

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Polling hook ─────────────────────────────────────────────────────────────
// Polls verifyUpgrade (server-verified: Stripe payment_status + DB grant) until
// it returns a terminal state. Success is ONLY shown when the server confirms
// the plan is active in the DB.

type PollState =
  | { phase: "checking" }
  | { phase: "done"; result: UpgradeVerifyResult }
  | { phase: "timed-out" };

function useUpgradeVerification(sessionId: string | null): PollState {
  const [state, setState] = useState<PollState>({ phase: "checking" });
  const attemptsRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setState({
        phase: "done",
        result: { status: "no-session" },
      });
      return;
    }

    let cancelled = false;
    doneRef.current = false;
    attemptsRef.current = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (cancelled || doneRef.current) return;
      try {
        const result = await verifyUpgrade({ data: { sessionId } });
        if (cancelled) return;
        attemptsRef.current += 1;

        const terminal =
          result.status === "active" ||
          result.status === "not-paid" ||
          result.status === "invalid" ||
          result.status === "no-session" ||
          result.status === "not-configured";
        if (terminal) {
          doneRef.current = true;
          setState({ phase: "done", result });
          return;
        }
        // "pending" (webhook not landed yet) → keep polling, then give up
        // with a friendly state instead of an endless spinner.
        if (attemptsRef.current >= MAX_POLLS) {
          doneRef.current = true;
          setState({ phase: "timed-out" });
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        // Transient network/server error — keep polling until the cap.
        if (cancelled) return;
        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_POLLS) {
          doneRef.current = true;
          setState({ phase: "timed-out" });
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  return state;
}

// ── States ───────────────────────────────────────────────────────────────────

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[80dvh] flex-col items-center justify-center px-4 text-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg shadow-gray-900/5 dark:border-gray-700 dark:bg-gray-900">
        {children}
      </div>
    </main>
  );
}

function ActionLinks() {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <Link
        to="/plans"
        className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        Back to plans
      </Link>
    </div>
  );
}

function UpgradeSuccessPage() {
  const search = Route.useSearch() as { session_id?: string };
  const sessionId = typeof search.session_id === "string" ? search.session_id : null;
  const state = useUpgradeVerification(sessionId);
  const { planInfo } = Route.useLoaderData();

  // ── Checking (initial) ────────────────────────────────────────────────
  if (state.phase === "checking") {
    return (
      <CenterCard>
        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Confirming your payment…
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          This usually takes just a few seconds. We're verifying your purchase
          with our payment provider.
        </p>
      </CenterCard>
    );
  }

  // ── Timed out (webhook still hasn't landed) ───────────────────────────
  if (state.phase === "timed-out") {
    return (
      <CenterCard>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
          <span className="text-2xl">⏳</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Your payment is still activating
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          We received your payment confirmation but your Pro access hasn't
          activated yet — it usually lands within seconds. Give it a moment and
          refresh this page. If it's been more than a few minutes, contact us
          at{" "}
          <a
            href="mailto:support@jobvaro.com"
            className="font-semibold text-indigo-600 dark:text-indigo-400"
          >
            support@jobvaro.com
          </a>{" "}
          with your payment reference and we'll sort it out right away.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110"
        >
          Check again
        </button>
        <ActionLinks />
      </CenterCard>
    );
  }

  // ── Terminal states ───────────────────────────────────────────────────
  const result = state.result;

  if (result.status === "active") {
    const paidPlan = (isPaidPlanName(result.plan) ? result.plan : "pro") as PaidPlan;
    const planName = PLAN_LABELS[paidPlan];
    const expiresAt = formatDate(result.expiresAt);
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
          <svg
            className="h-10 w-10 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
          Welcome to {planName}!
        </h1>
        <p className="mt-3 max-w-md text-lg text-gray-500 dark:text-gray-400">
          Your {planName} access is active and runs through{" "}
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            {expiresAt}
          </span>{" "}
          — a one-time purchase with no auto-renewal. Here's what you've
          unlocked:
        </p>
        <ul className="mt-8 w-full max-w-sm space-y-3 text-left">
          {proFeatureList.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {feature}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/track"
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110"
          >
            Go to your applications
          </Link>
          <Link
            to="/search"
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Search jobs
          </Link>
        </div>
      </main>
    );
  }

  if (result.status === "not-paid") {
    return (
      <CenterCard>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
          <span className="text-2xl">💳</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Payment not completed
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          We don't see a completed payment for this checkout. It may have been
          cancelled or is still processing. You can head back to the plans page
          and try again — your progress and data are safe.
        </p>
        <div className="mt-6">
          <Link
            to="/plans"
            className="inline-block rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110"
          >
            Back to plans
          </Link>
        </div>
        <ActionLinks />
      </CenterCard>
    );
  }

  if (result.status === "not-configured") {
    return (
      <CenterCard>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Payments aren't set up yet
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          We're not accepting payments at the moment. Please check back soon.
        </p>
        <ActionLinks />
      </CenterCard>
    );
  }

  // no-session / invalid / anything unexpected
  return (
    <CenterCard>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
        We couldn't verify this purchase
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        {planInfo?.isPro
          ? "Good news — your Pro access is already active, so you're all set."
          : "This page needs a valid payment reference from the checkout flow. If you just paid and still see this, contact us at support@jobvaro.com."}
      </p>
      <div className="mt-6">
        <Link
          to={planInfo?.isPro ? "/track" : "/plans"}
          className="inline-block rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110"
        >
          {planInfo?.isPro ? "Go to your applications" : "Back to plans"}
        </Link>
      </div>
      <ActionLinks />
    </CenterCard>
  );
}

function isPaidPlanName(plan: string): boolean {
  return plan === "pro" || plan === "sprint" || plan === "momentum";
}

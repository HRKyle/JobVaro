import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { getCurrentUser, type AuthUser } from "~/auth/functions";
import { getCurrentPlan, type PlanInfo } from "~/services/plans";

// ── Configurable Stripe checkout URL ─────────────────────────────────────────
// Update this when the actual Stripe payment link is created.
const STRIPE_CHECKOUT_URL = "/stripe-checkout";

// ── Server loader ────────────────────────────────────────────────────────────

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "JobHub";
  } catch {
    return "JobHub";
  }
});

export const Route = createFileRoute("/plans")({
  loader: async () => {
    const [businessName, userResult, planInfo] = await Promise.all([
      getBusinessName(),
      getCurrentUser(),
      getCurrentPlan(),
    ]);
    return { businessName, user: userResult.user, planInfo };
  },
  component: PlansPage,
});

// ── Feature row ──────────────────────────────────────────────────────────────

interface Feature {
  name: string;
  free: boolean;
  pro: boolean;
}

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 px-4 ${
        index % 2 === 0
          ? "bg-gray-50 dark:bg-gray-800/40"
          : "bg-white dark:bg-gray-900"
      }`}
    >
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {feature.name}
      </span>
      <div className="flex items-center gap-12">
        {/* Free column */}
        <span className="w-12 text-center">
          {feature.free ? (
            <svg
              className="mx-auto h-5 w-5 text-green-500"
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
          ) : (
            <svg
              className="mx-auto h-5 w-5 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </span>
        {/* Pro column */}
        <span className="w-12 text-center">
          {feature.pro ? (
            <svg
              className="mx-auto h-5 w-5 text-indigo-500"
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
          ) : (
            <svg
              className="mx-auto h-5 w-5 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </span>
      </div>
    </div>
  );
}

// ── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  name,
  price,
  description,
  features,
  isPro,
  isCurrentPlan,
  ctaLink,
  ctaLabel,
  ctaDisabled,
  highlight,
}: {
  name: string;
  price: string;
  description: string;
  features: { name: string; included: boolean }[];
  isPro: boolean;
  isCurrentPlan: boolean;
  ctaLink: string;
  ctaLabel: string;
  ctaDisabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 ${
        highlight
          ? "border-2 border-transparent bg-white shadow-xl shadow-indigo-500/15 ring-1 ring-indigo-300 dark:bg-gray-900 dark:ring-indigo-700 [background:linear-gradient(white,white)_padding-box,linear-gradient(135deg,#4F46E5,#8B5CF6)_border-box] dark:[background:linear-gradient(#111827,#111827)_padding-box,linear-gradient(135deg,#4F46E5,#8B5CF6)_border-box]"
          : "border border-gray-200 bg-white shadow-sm hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-0.5 text-xs font-bold text-gray-900 shadow-md shadow-amber-500/30">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5L5.7 21l2.3-7.2-6-4.6h7.6z" />
          </svg>
          Recommended
        </span>
      )}

      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
        {name}
      </h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          {price}
        </span>
        {price !== "Free" && (
          <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>

      {/* Features list */}
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((f) => (
          <li key={f.name} className="flex items-start gap-2.5 text-sm">
            {f.included ? (
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500"
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
            ) : (
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            <span
              className={
                f.included
                  ? "text-gray-700 dark:text-gray-300"
                  : "text-gray-400 dark:text-gray-500"
              }
            >
              {f.name}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-6">
        {isCurrentPlan ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-sm font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            {isPro ? "You're on the Pro plan" : "Current plan"}
          </div>
        ) : (
          <a
            href={ctaLink}
            className={`block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
              ctaDisabled
                ? "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                : highlight
                  ? "bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25 hover:shadow-lg hover:brightness-110"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function PlansPage() {
  const { businessName, user, planInfo } = Route.useLoaderData();
  const isPro = planInfo?.isPro ?? false;

  const freeFeatures = [
    { name: "Basic search", included: true },
    { name: "Up to 20 tracked applications", included: true },
    { name: "Basic filters", included: true },
    { name: "Application status tracking", included: true },
    { name: "Timeline events", included: true },
    { name: "Unlimited tracked applications", included: false },
    { name: "Advanced search filters", included: false },
    { name: "Application analytics", included: false },
    { name: "Email reminders", included: false },
    { name: "Priority support", included: false },
  ];

  const proFeatures = [
    { name: "Basic search", included: true },
    { name: "Basic filters", included: true },
    { name: "Application status tracking", included: true },
    { name: "Timeline events", included: true },
    { name: "Unlimited tracked applications", included: true },
    { name: "Advanced search filters", included: true },
    { name: "Application analytics", included: true },
    { name: "Email reminders", included: true },
    { name: "Priority support", included: true },
  ];

  // Convert features to the comparison table format
  const allFeatureNames = Array.from(
    new Set([
      ...freeFeatures.map((f) => f.name),
      ...proFeatures.map((f) => f.name),
    ]),
  );

  const featureMap = new Map(
    allFeatureNames.map((name) => {
      const free =
        freeFeatures.find((f) => f.name === name)?.included ?? false;
      const pro =
        proFeatures.find((f) => f.name === name)?.included ?? true;
      return [name, { free, pro }];
    }),
  );

  // Order features logically
  const orderedFeatures = [
    "Basic search",
    "Basic filters",
    "Advanced search filters",
    "Application status tracking",
    "Timeline events",
    "Up to 20 tracked applications",
    "Unlimited tracked applications",
    "Application analytics",
    "Email reminders",
    "Priority support",
  ].filter((name) => featureMap.has(name));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
          Choose your plan
        </h1>
        <p className="mt-3 text-lg text-gray-500 dark:text-gray-400">
          Get the most out of {businessName} with the right plan for your job
          search.
        </p>
      </div>

      {/* Pro status banner */}
      {isPro && (
        <div className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center dark:border-indigo-800 dark:bg-indigo-950/50">
          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
            🎉 You're on the Pro plan — enjoy unlimited tracking and all premium
            features.
          </p>
        </div>
      )}

      {/* Plan cards (mobile-friendly stacked layout) */}
      <div className="mb-12 grid gap-6 md:grid-cols-2">
        <PlanCard
          name="Free"
          price="Free"
          description="Everything you need to get started with your job search."
          features={freeFeatures}
          isPro={false}
          isCurrentPlan={!isPro}
          ctaLink="#"
          ctaLabel={!isPro ? "Current plan" : "Downgrade"}
          ctaDisabled={!isPro}
        />
        <PlanCard
          name="Pro"
          price="$12"
          description="Unlock unlimited tracking and advanced features."
          features={proFeatures}
          isPro={true}
          isCurrentPlan={isPro}
          ctaLink={isPro ? "#" : STRIPE_CHECKOUT_URL}
          ctaLabel={isPro ? "Current plan" : "Upgrade to Pro"}
          highlight={!isPro}
        />
      </div>

      {/* Side-by-side comparison table (desktop) */}
      <div className="hidden md:block">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          Detailed comparison
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          {/* Table header */}
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-gray-100 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Feature
            </span>
            <div className="flex items-center gap-12">
              <span className="w-12 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                Free
              </span>
              <span className="w-12 text-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                Pro
              </span>
            </div>
          </div>
          {/* Feature rows */}
          {orderedFeatures.map((name, i) => {
            const fm = featureMap.get(name)!;
            return <FeatureRow key={name} feature={{ name, ...fm }} index={i} />;
          })}
        </div>
      </div>

      {/* Mobile comparison — simpler stacked, two-column list */}
      <div className="md:hidden">
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
          Detailed comparison
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-gray-100 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Feature
            </span>
            <div className="flex items-center gap-8">
              <span className="w-10 text-center text-xs font-semibold text-gray-900 dark:text-gray-100">
                Free
              </span>
              <span className="w-10 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                Pro
              </span>
            </div>
          </div>
          {orderedFeatures.map((name, i) => {
            const fm = featureMap.get(name)!;
            return <FeatureRow key={name} feature={{ name, ...fm }} index={i} />;
          })}
        </div>
      </div>

      {/* FAQ / reassurance */}
      <div className="mt-12 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          You can upgrade, downgrade, or cancel at any time. No long-term
          contracts.
        </p>
      </div>
    </main>
  );
}

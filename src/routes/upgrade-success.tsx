import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser, type AuthUser } from "~/auth/functions";
import { getCurrentPlan, type PlanInfo } from "~/services/plans";

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

const proFeatureList = [
  "Unlimited tracked applications",
  "Advanced search filters",
  "Application analytics dashboard",
  "Email reminders for follow-ups",
  "Priority support",
];

function UpgradeSuccessPage() {
  const { user, planInfo } = Route.useLoaderData();

  return (
    <main className="flex min-h-[80dvh] flex-col items-center justify-center px-4 text-center">
      {/* Success icon */}
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
        Welcome to Pro!
      </h1>
      <p className="mt-3 max-w-md text-lg text-gray-500 dark:text-gray-400">
        {user?.name ? `Thanks, ${user.name}!` : "Thanks!"} Your Pro subscription
        is now active. Here's what you've unlocked:
      </p>

      {/* Feature unlocks */}
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

      {/* Actions */}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <a
          href="/track"
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Go to your applications
        </a>
        <a
          href="/search"
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Search jobs
        </a>
      </div>
    </main>
  );
}

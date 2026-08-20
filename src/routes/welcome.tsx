import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "~/auth/functions";

// ══════════════════════════════════════════════════════════════════════
// Welcome / Dashboard — the landing spot immediately after login/signup.
// Greets the user and lays out every JobVaro feature with a plain-English
// explanation and a link into it. Only logged-in users may view it.
// ══════════════════════════════════════════════════════════════════════

export const Route = createFileRoute("/welcome")({
  loader: async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      // Logged-out visitors are sent to the sign-in flow.
      throw redirect({ to: "/track" });
    }
    return { user };
  },
  component: WelcomePage,
});

type Feature = {
  href: string;
  title: string;
  tagline: string;
  description: string;
  icon: string; // d path for an inline SVG (24x24 stroke)
  accent: string; // tailwind gradient stops for the icon chip
};

const FEATURES: Feature[] = [
  {
    href: "/track",
    title: "Track Applications",
    tagline: "Your application pipeline",
    description:
      "Keep every application in one place — add a job URL and we auto-fill the details, or enter it manually. Move jobs through a status pipeline (Applied, Interview, Offer…) and never lose track of a follow-up again.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    accent: "from-indigo-600 to-violet-500",
    cta: "Open your tracker",
  },
  {
    href: "/search",
    title: "Job Search",
    tagline: "Find your next role",
    description:
      "Search jobs and paste any listing to auto-save it straight into your tracker. One click and the role is organized, no spreadsheet required.",
    icon: "M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z",
    accent: "from-blue-600 to-cyan-500",
    cta: "Start searching",
  },
  {
    href: "/community",
    title: "Community Job Board",
    tagline: "Jobs shared by the community",
    description:
      "Discover roles that other job seekers have shared, and post jobs you find to help others. Browse, save, and track anything that fits.",
    icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-6.92M14 20h3a3 3 0 00-3-3m-2 3H8a3 3 0 013-3m5-9a3 3 0 11-6 0 3 3 0 016 0z",
    accent: "from-emerald-600 to-teal-500",
    cta: "Browse jobs",
  },
  {
    href: "/companies",
    title: "Companies",
    tagline: "Research employers",
    description:
      "See companies and their roles at a glance, so you can shortlist the places worth applying to and keep your target list organized.",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    accent: "from-orange-500 to-amber-500",
    cta: "Explore companies",
  },
  {
    href: "/compass",
    title: "Compass AI Scoring",
    tagline: "Check your real odds",
    description:
      "Upload your résumé and we'll match it against a job with an AI score and actionable feedback — so you know which applications are worth your time and how to improve them.",
    icon: "M9 12l2 2 4-4m5.62-1.62A9 9 0 1112 3a9 9 0 015.62 1.62z",
    accent: "from-violet-600 to-purple-500",
    cta: "Run an analysis",
  },
  {
    href: "/plans",
    title: "Plans & Upgrade",
    tagline: "Get more out of JobVaro",
    description:
      "Free is yours forever. Unlock unlimited tracking and more Compass analyses with a one-time Pro, Sprint, or Momentum pass — no auto-renewal, ever.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    accent: "from-amber-500 to-yellow-500",
  },
];

function WelcomePage() {
  const { user } = Route.useLoaderData();
  return (
    <main className="relative overflow-hidden px-6 py-12 sm:py-16">
      {/* Decorative gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-white dark:from-indigo-950/30 dark:via-gray-950 dark:to-gray-950" />
      <div className="bg-grid-slate pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />

      <div className="mx-auto max-w-5xl">
        {/* ── Greeting + plan status ── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
              Welcome to JobVaro
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 sm:text-4xl">
              Hi{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-500 bg-clip-text text-transparent">
                {user.name?.split(" ")[0] ?? "there"}
              </span>
              👋
            </h1>
            <p className="mt-2 max-w-xl text-gray-600 dark:text-gray-400">
              Your job search command center — Find, Match, Apply, and Track.
              Here's everything you can do with JobVaro.
            </p>
          </div>

          {/* Plan / upgrade pill */}
          <div className="shrink-0">
            {user.plan === "pro" ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                </span>
                Pro plan active
              </div>
            ) : (
              <a
                href="/plans"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:shadow-lg hover:brightness-110 active:scale-95"
              >
                ⚡ Upgrade to Pro
              </a>
            )}
          </div>
        </div>

        {/* ── Compass featured hero ── */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-8 shadow-lg shadow-indigo-500/10 dark:border-indigo-800 dark:from-indigo-950/50 dark:via-gray-950 dark:to-violet-950/30 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 opacity-10 blur-3xl" />
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/90 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            🛡️ Proprietary HRKyle methodology
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 sm:text-4xl">
            Know your real odds{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-500 bg-clip-text text-transparent">
              before you apply.
            </span>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600 dark:text-gray-400">
            Compass scores your résumé against any role using JobVaro&apos;s own
            recruitment-built methodology — the same factors real AI screening
            systems weigh — and tells you honestly whether it&apos;s worth
            applying, and how to improve. That&apos;s the headline feature here;
            the rest below keeps your search organized around it.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="/compass"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-7 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:shadow-lg hover:brightness-110 active:scale-95"
            >
              Check your fit — free
            </a>
            <a
              href="/compass"
              className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400"
            >
              See how the score works
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </div>

        {/* ── One-stop-shop journey ── */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { step: "Find", desc: "Search & community jobs" },
            { step: "Match", desc: "Compass score", headline: true },
            { step: "Apply", desc: "Quick Add any URL" },
            { step: "Track", desc: "Your pipeline" },
            { step: "Community", desc: "Share & discover" },
          ].map((s) => (
            <div
              key={s.step}
              className={`rounded-xl border px-4 py-3 text-center ${
                s.headline
                  ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/50"
                  : "border-gray-200 bg-white/70 dark:border-gray-800 dark:bg-gray-900/60"
              }`}
            >
              <p
                className={`text-sm font-bold ${
                  s.headline
                    ? "bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent"
                    : "text-gray-800 dark:text-gray-100"
                }`}
              >
                {s.step}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-gray-500 dark:text-gray-400">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        {/* ── Feature grid ── */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <a
              key={f.href + f.title}
              href={f.href}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-700"
            >
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${f.accent} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`}
              />
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-white shadow-md`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </span>
                <svg
                  className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-indigo-500 dark:text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                {f.tagline}
              </p>
              <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-50">{f.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {f.description}
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {f.href === "/plans"
                  ? user.plan === "pro"
                    ? "Manage plans"
                    : "See plans & upgrade"
                  : f.cta}
              </span>
            </a>
          ))}
        </div>

        {/* ── Quick-start tip strip ── */}
        <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white/70 p-6 dark:border-gray-800 dark:bg-gray-900/60 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">
              Pro tip: start by saving a job
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Head to Job Search, paste any listing URL, and it lands in your
              tracker ready for you to apply.
            </p>
          </div>
          <a
            href="/search"
            className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:shadow-lg hover:brightness-110 active:scale-95"
          >
            Search jobs
          </a>
        </div>
      </div>
    </main>
  );
}

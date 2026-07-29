import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useState, useCallback, useEffect, useRef } from "react";
import { getCurrentUser, logout, type AuthUser } from "~/auth/functions";
import { AuthForms } from "~/components/AuthForms";
import { BookmarkletInstructions } from "~/components/BookmarkletInstructions";

// Read the business name at request time from site.json
const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "";
  } catch {
    return "";
  }
});

export const Route = createFileRoute("/")({
  loader: async () => {
    const [businessName, userResult] = await Promise.all([
      getBusinessName(),
      getCurrentUser(),
    ]);
    return { businessName, user: userResult.user };
  },
  component: Home,
});

// ── Scroll fade-in hook ──────────────────────────────────────────────────────
function useScrollFade(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const el = ref.current;
    if (!el) return;

    // Check if already in viewport (above the fold)
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }

    // Start hidden for below-fold items, then reveal on scroll
    setVisible(false);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, mounted]);

  return { ref, visible };
}

// ── Section wrapper with fade-in ─────────────────────────────────────────────
function FadeInSection({
  children,
  className = "",
  threshold,
}: {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}) {
  const { ref, visible } = useScrollFade(threshold);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ── Feature Card component ───────────────────────────────────────────────────
function FeatureCard({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-1 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl transition-colors group-hover:bg-indigo-100 dark:bg-indigo-950 dark:group-hover:bg-indigo-900">
        {emoji}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

// ── Step component ───────────────────────────────────────────────────────────
function Step({
  number,
  title,
  description,
  emoji,
}: {
  number: number;
  title: string;
  description: string;
  emoji: string;
}) {
  return (
    <div className="relative flex flex-col items-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-2xl shadow-lg shadow-indigo-500/25">
        {emoji}
      </div>
      <div className="mb-2 rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
        Step {number}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      <p className="max-w-xs text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

// ── Pricing card ─────────────────────────────────────────────────────────────
function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  highlighted = false,
  planId,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  planId?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-8 transition-all duration-300 hover:shadow-lg ${
        highlighted
          ? "border-indigo-300 bg-white shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-200 dark:border-indigo-700 dark:bg-gray-900 dark:ring-indigo-800"
          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-bold text-white">
          Most Popular
        </span>
      )}
      <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        {name}
      </h3>
      <div className="mb-6">
        <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
          {price}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {period}
        </span>
      </div>
      <ul className="mb-8 space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <a
        href={planId === "signup" ? "#signup" : "/plans"}
        className={`block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all ${
          highlighted
            ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/25"
            : "border-2 border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
        }`}
      >
        {cta}
      </a>
    </div>
  );
}

// ── Main Home component ──────────────────────────────────────────────────────
function Home() {
  const { businessName, user: initialUser } = Route.useLoaderData();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const navigate = useNavigate();

  // Logged-in users are redirected to /track (the main dashboard)
  useEffect(() => {
    if (user) {
      navigate({ to: "/track", replace: true });
    }
  }, [user, navigate]);

  const handleAuthSuccess = useCallback((u: AuthUser) => {
    setUser(u);
  }, []);

  // ── Loading / redirecting state for logged-in users ──────────────────────
  if (user) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Redirecting to your dashboard…
        </p>
      </main>
    );
  }

  const brandName = businessName || "JobVaro";

  // ── Logged-out marketing homepage ─────────────────────────────────────────
  return (
    <main className="overflow-x-hidden">
      {/* ══════════════════════════════════════════════════════════════════════
          HERO SECTION
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-20 text-center">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-white dark:from-indigo-950/40 dark:via-gray-950 dark:to-gray-950" />

        {/* Decorative blobs */}
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-indigo-100/60 blur-3xl dark:bg-indigo-900/20" />
        <div className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-purple-100/60 blur-3xl dark:bg-purple-900/20" />

        <FadeInSection>
          <div className="mx-auto mb-6 flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            <span className="flex h-2 w-2 rounded-full bg-green-500" />
            Now in public beta
          </div>
        </FadeInSection>

        <FadeInSection>
          <h1 className="mx-auto mb-6 max-w-4xl text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent dark:from-white dark:via-gray-200 dark:to-gray-400">
              Your Personal Job Search
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Command Center
            </span>
          </h1>
        </FadeInSection>

        <FadeInSection threshold={0.1}>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            Track every application in one place. Paste a job URL and we
            auto-fill the details. Save jobs from any site with one click.
            Never lose an opportunity again.
          </p>
        </FadeInSection>

        <FadeInSection>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <a
              href="#signup"
              className="rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
            >
              Get Started Free
            </a>
            <a
              href="#how-it-works"
              className="group flex items-center gap-2 rounded-xl border-2 border-gray-300 px-8 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-900"
            >
              See How It Works
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-y-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </a>
          </div>
        </FadeInSection>

        {/* Hero illustration — icon grid */}
        <FadeInSection threshold={0.05}>
          <div className="mt-16 grid grid-cols-3 gap-4 sm:grid-cols-6">
            {["📋", "💼", "✅", "🔔", "📊", "🚀"].map((emoji, i) => (
              <div
                key={i}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:bg-gray-800 dark:ring-gray-800"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {emoji}
              </div>
            ))}
          </div>
        </FadeInSection>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="px-6 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-5xl">
          <FadeInSection>
            <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
              How It Works
            </h2>
            <p className="mx-auto mb-16 max-w-xl text-center text-gray-600 dark:text-gray-400">
              Three simple steps to take control of your job search
            </p>
          </FadeInSection>

          <div className="relative grid gap-8 sm:grid-cols-3">
            {/* Connector line between steps (desktop only) */}
            <div className="absolute left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] top-8 hidden h-0.5 bg-gradient-to-r from-indigo-200 via-indigo-300 to-indigo-200 sm:block dark:from-indigo-800 dark:via-indigo-700 dark:to-indigo-800" />

            <FadeInSection>
              <Step
                number={1}
                emoji="🔍"
                title="Find & Save"
                description="Browse jobs shared by the community, or paste any job URL and we extract the details automatically."
              />
            </FadeInSection>
            <FadeInSection threshold={0.1}>
              <Step
                number={2}
                emoji="📋"
                title="Track Everything"
                description="Log every application with status tracking, notes, follow-ups, and a full timeline of your progress."
              />
            </FadeInSection>
            <FadeInSection threshold={0.1}>
              <Step
                number={3}
                emoji="🎯"
                title="Land the Job"
                description="Stay organized, never miss a follow-up, and convert more applications into interview calls and offers."
              />
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FEATURE SHOWCASE
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 px-6 py-24 sm:py-32 dark:bg-gray-900/50">
        <div className="mx-auto max-w-5xl">
          <FadeInSection>
            <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
              Everything You Need
            </h2>
            <p className="mx-auto mb-16 max-w-xl text-center text-gray-600 dark:text-gray-400">
              Powerful tools designed to streamline your entire job search
              workflow
            </p>
          </FadeInSection>

          <div className="grid gap-6 sm:grid-cols-2">
            <FadeInSection>
              <FeatureCard
                emoji="⚡"
                title="URL Quick Add"
                description="Paste any job listing URL — Indeed, LinkedIn, Glassdoor, or a company careers page. We auto-fill the title, company name, and key details so you don't have to type a thing."
              />
            </FadeInSection>
            <FadeInSection threshold={0.1}>
              <FeatureCard
                emoji="🧩"
                title="Browser Extension"
                description="Save jobs from any site with a single click. Browse wherever you like, and your extension instantly sends listings to your JobVaro tracker. No copy-paste needed."
              />
            </FadeInSection>
            <FadeInSection threshold={0.1}>
              <FeatureCard
                emoji="🌐"
                title="Community Board"
                description="Discover jobs shared by fellow job seekers and contribute your own finds. A collaborative job board where everyone benefits from collective searching."
              />
            </FadeInSection>
            <FadeInSection threshold={0.1}>
              <FeatureCard
                emoji="🏢"
                title="Company Watchlist"
                description="Follow the companies you care about and get notified when new positions open. Never miss an opportunity at your dream employer."
              />
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FOR JOB SEEKERS
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: text content */}
            <FadeInSection>
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
                Stop juggling spreadsheets and browser tabs
              </h2>
              <p className="mb-8 text-lg leading-relaxed text-gray-600 dark:text-gray-400">
                Your job search deserves better than a messy spreadsheet. JobVaro
                gives you a clean, focused workspace where every application has
                its place.
              </p>

              <ul className="space-y-4">
                {[
                  {
                    title: "Application Pipeline",
                    desc: "Visualize every stage — from saved to applied, interviewing, and offer received.",
                    emoji: "🔄",
                  },
                  {
                    title: "Status Tracking",
                    desc: "Update statuses in one click and always know where each application stands.",
                    emoji: "📌",
                  },
                  {
                    title: "Follow-up Reminders",
                    desc: "Never forget to follow up. Set reminders and get notified when it's time to reach out.",
                    emoji: "🔔",
                  },
                  {
                    title: "Full Timeline View",
                    desc: "See your entire job search history at a glance — every action, note, and status change.",
                    emoji: "📅",
                  },
                ].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-lg dark:bg-indigo-950">
                      {item.emoji}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {item.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </FadeInSection>

            {/* Right: dashboard mockup */}
            <FadeInSection threshold={0.1}>
              <div className="relative rounded-2xl border border-gray-200 bg-white p-1 shadow-xl shadow-gray-200/50 dark:border-gray-800 dark:bg-gray-900 dark:shadow-gray-950/50">
                {/* Mock browser chrome */}
                <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                  <div className="ml-4 h-4 w-40 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
                {/* Mock content */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800" />
                      <div className="mt-2 h-5 w-40 rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                    <div className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                      Applied
                    </div>
                  </div>
                  <div className="flex gap-6 text-xs text-gray-400">
                    <span>📅 Applied Jun 12</span>
                    <span>🔔 Follow up Jul 5</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      ["Applied", "green"],
                      ["Phone Screen", "blue"],
                      ["Interview", "purple"],
                      ["Offer", "amber"],
                    ].map(([stage, color], i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
                      >
                        <div
                          className={`h-2 w-2 rounded-full bg-${color}-500`}
                        />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {stage}
                        </span>
                        <span className="ml-auto text-xs text-gray-400">
                          {i + 1} app
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          BOOKMARKLET — ONE-CLICK SAVE
          ══════════════════════════════════════════════════════════════════════ */}
      <BookmarkletInstructions animated />

      {/* ══════════════════════════════════════════════════════════════════════
          PRICING
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 px-6 py-24 sm:py-32 dark:bg-gray-900/50">
        <div className="mx-auto max-w-5xl">
          <FadeInSection>
            <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
              Simple, Transparent Pricing
            </h2>
            <p className="mx-auto mb-16 max-w-xl text-center text-gray-600 dark:text-gray-400">
              Start free and upgrade when you&apos;re ready for more power
            </p>
          </FadeInSection>

          <div className="mx-auto grid max-w-2xl gap-8 lg:grid-cols-2">
            <FadeInSection>
              <PricingCard
                name="Free"
                price="$0"
                period="forever"
                features={[
                  "Up to 20 tracked applications",
                  "Basic job search",
                  "Community job board access",
                  "URL auto-fill for jobs",
                  "Browser extension",
                ]}
                cta="Start Free"
                planId="signup"
              />
            </FadeInSection>
            <FadeInSection threshold={0.1}>
              <PricingCard
                name="Pro"
                price="$12"
                period="/month"
                features={[
                  "Unlimited tracked applications",
                  "Advanced search filters",
                  "Application analytics dashboard",
                  "Follow-up reminders & notifications",
                  "Company watchlist",
                  "Priority support",
                ]}
                cta="Upgrade to Pro"
                highlighted
              />
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SIGN-UP
          ══════════════════════════════════════════════════════════════════════ */}
      <section id="signup" className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-lg">
          <FadeInSection>
            <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Ready to take control of your job search?
            </h2>
            <p className="mb-10 text-center text-gray-600 dark:text-gray-400">
              Create your free account and start tracking applications in under a
              minute.
            </p>
          </FadeInSection>

          <FadeInSection threshold={0.1}>
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <AuthForms onAuthSuccess={handleAuthSuccess} />
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
          ══════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-200 bg-white px-6 py-12 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            {/* Logo */}
            <a
              href="/"
              className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100"
            >
              <svg
                className="h-7 w-7 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              {brandName}
            </a>

            {/* Links */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <a
                href="/search"
                className="transition hover:text-gray-900 dark:hover:text-gray-200"
              >
                Search
              </a>
              <a
                href="/community"
                className="transition hover:text-gray-900 dark:hover:text-gray-200"
              >
                Community
              </a>
              <a
                href="/companies"
                className="transition hover:text-gray-900 dark:hover:text-gray-200"
              >
                Companies
              </a>
              <a
                href="/track"
                className="transition hover:text-gray-900 dark:hover:text-gray-200"
              >
                Track
              </a>
              <a
                href="/plans"
                className="transition hover:text-gray-900 dark:hover:text-gray-200"
              >
                Plans
              </a>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-100 pt-6 text-center text-sm text-gray-400 dark:border-gray-800 dark:text-gray-600">
            Built with{" "}
            <a
              href="https://cto.new"
              className="underline transition hover:text-gray-600 dark:hover:text-gray-400"
            >
              cto.new
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

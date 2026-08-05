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

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }

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

// ── Feature Card component (icons in colored circles) ────────────────────────
const FEATURE_ICONS: Record<number, { bg: string; ring: string }> = {
  0: {
    bg: "bg-indigo-50 group-hover:bg-indigo-100 dark:bg-indigo-950 dark:group-hover:bg-indigo-900",
    ring: "ring-indigo-100 dark:ring-indigo-900",
  },
  1: {
    bg: "bg-violet-50 group-hover:bg-violet-100 dark:bg-violet-950 dark:group-hover:bg-violet-900",
    ring: "ring-violet-100 dark:ring-violet-900",
  },
  2: {
    bg: "bg-amber-50 group-hover:bg-amber-100 dark:bg-amber-950 dark:group-hover:bg-amber-900",
    ring: "ring-amber-100 dark:ring-amber-900",
  },
  3: {
    bg: "bg-green-50 group-hover:bg-green-100 dark:bg-green-950 dark:group-hover:bg-green-900",
    ring: "ring-green-100 dark:ring-green-900",
  },
};

function FeatureCard({
  emoji,
  title,
  description,
  index,
}: {
  emoji: string;
  title: string;
  description: string;
  index: number;
}) {
  const icon = FEATURE_ICONS[index % 4];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-indigo-500/10 dark:border-gray-800 dark:bg-gray-900">
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-600 to-violet-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl ring-1 transition-all duration-300 ${icon.bg} ${icon.ring}`}
      >
        {emoji}
      </div>
      <h3 className="mb-2 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
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
      <div className="relative mb-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-2xl shadow-lg shadow-indigo-500/30">
          {emoji}
        </div>
        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-extrabold text-gray-900 shadow-md ring-2 ring-white dark:ring-gray-950">
          {number}
        </span>
      </div>
      <h3 className="mb-2 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
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
      className={`relative flex flex-col rounded-2xl p-8 transition-all duration-300 ${
        highlighted
          ? "border-2 border-transparent bg-white shadow-xl shadow-indigo-500/15 ring-1 ring-indigo-300 dark:bg-gray-900 dark:ring-indigo-700 [background:linear-gradient(white,white)_padding-box,linear-gradient(135deg,#4F46E5,#8B5CF6)_border-box] dark:[background:linear-gradient(#111827,#111827)_padding-box,linear-gradient(135deg,#4F46E5,#8B5CF6)_border-box]"
          : "border border-gray-200 bg-white shadow-sm hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-1 text-xs font-bold text-gray-900 shadow-md shadow-amber-500/30">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5L5.7 21l2.3-7.2-6-4.6h7.6z" />
          </svg>
          Most Popular
        </span>
      )}
      <h3 className="mb-2 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
        {name}
      </h3>
      <div className="mb-6">
        <span className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {price}
        </span>
        <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">
          {period}
        </span>
      </div>
      <ul className="mb-8 flex-1 space-y-3">
        {features.map((f, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400"
          >
            <span
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                highlighted
                  ? "bg-gradient-to-br from-indigo-600 to-violet-500 text-white"
                  : "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
              }`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            {f}
          </li>
        ))}
      </ul>
      <a
        href={planId === "signup" ? "#signup" : "/plans"}
        className={`block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all active:scale-[0.98] ${
          highlighted
            ? "bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40"
            : "border-2 border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
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
      <section className="relative flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
        {/* Animated background: gradient + grid + floating blobs */}
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-white dark:from-indigo-950/40 dark:via-gray-950 dark:to-gray-950" />
        <div className="bg-grid-slate absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]" />
        <div className="animate-float-slow absolute -left-24 top-1/4 -z-10 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl dark:bg-indigo-700/20" />
        <div className="animate-float-slower absolute -right-24 bottom-1/4 -z-10 h-80 w-80 rounded-full bg-violet-200/50 blur-3xl dark:bg-violet-700/20" />
        <div className="animate-float-slow absolute left-1/3 top-10 -z-10 h-40 w-40 rounded-full bg-amber-100/60 blur-3xl dark:bg-amber-600/10" />

        <FadeInSection>
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Now in public beta
          </div>
        </FadeInSection>

        <FadeInSection>
          <h1 className="mx-auto mb-6 max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent dark:from-white dark:via-gray-200 dark:to-gray-400">
              Your Personal Job Search
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-500 bg-clip-text text-transparent">
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
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110 active:scale-95"
            >
              Get Started Free
            </a>
            <a
              href="#how-it-works"
              className="group flex items-center gap-2 rounded-xl border-2 border-gray-300 bg-white/60 px-8 py-3.5 text-base font-semibold text-gray-700 backdrop-blur transition-all hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
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
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl shadow-md ring-1 ring-gray-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:ring-indigo-200 dark:bg-gray-800 dark:ring-gray-800 dark:hover:ring-indigo-700"
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
      <section id="how-it-works" className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <FadeInSection>
            <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
              How It Works
            </h2>
            <p className="mx-auto mb-16 max-w-xl text-center text-gray-600 dark:text-gray-400">
              Three simple steps to take control of your job search
            </p>
          </FadeInSection>

          <div className="relative grid gap-10 sm:grid-cols-3">
            {/* Connector line between steps (desktop only) */}
            <div className="absolute left-[calc(16.67%+2.5rem)] right-[calc(16.67%+2.5rem)] top-8 hidden h-0.5 bg-gradient-to-r from-indigo-200 via-indigo-300 to-indigo-200 sm:block dark:from-indigo-800 dark:via-indigo-700 dark:to-indigo-800" />

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
        <div className="mx-auto max-w-6xl">
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
                index={0}
                emoji="⚡"
                title="URL Quick Add"
                description="Paste any job listing URL — Indeed, LinkedIn, Glassdoor, or a company careers page. We auto-fill the title, company name, and key details so you don't have to type a thing."
              />
            </FadeInSection>
            <FadeInSection threshold={0.1}>
              <FeatureCard
                index={1}
                emoji="🧩"
                title="Browser Extension"
                description="Save jobs from any site with a single click. Browse wherever you like, and your extension instantly sends listings to your JobVaro tracker. No copy-paste needed."
              />
            </FadeInSection>
            <FadeInSection threshold={0.1}>
              <FeatureCard
                index={2}
                emoji="🌐"
                title="Community Board"
                description="Discover jobs shared by fellow job seekers and contribute your own finds. A collaborative job board where everyone benefits from collective searching."
              />
            </FadeInSection>
            <FadeInSection threshold={0.1}>
              <FeatureCard
                index={3}
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
        <div className="mx-auto max-w-6xl">
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
                <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                  <div className="ml-4 h-4 w-40 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="space-y-4 p-5">
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
        <div className="mx-auto max-w-6xl">
          <FadeInSection>
            <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
              Simple, Transparent Pricing
            </h2>
            <p className="mx-auto mb-16 max-w-xl text-center text-gray-600 dark:text-gray-400">
              Start free and upgrade when you&apos;re ready for more power
            </p>
          </FadeInSection>

          <div className="mx-auto grid max-w-3xl gap-8 pt-4 lg:grid-cols-2">
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
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-900/5 dark:border-gray-800 dark:bg-gray-900">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-100/60 blur-3xl dark:bg-indigo-900/30" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-100/60 blur-3xl dark:bg-violet-900/20" />
              <div className="relative">
                <AuthForms onAuthSuccess={handleAuthSuccess} />
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>
    </main>
  );
}

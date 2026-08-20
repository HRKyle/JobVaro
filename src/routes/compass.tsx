import { createFileRoute } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { getCurrentUser, type AuthUser } from "~/auth/functions";
import { AuthForms } from "~/components/AuthForms";
import { analyzeCompass, type CompassReport } from "~/services/compass";

export const Route = createFileRoute("/compass")({
  loader: async () => (await getCurrentUser()).user,
  component: CompassPage,
});

const input =
  "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500";

const card =
  "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900";

function CompassPage() {
  const user = Route.useLoaderData();
  if (!user)
    return (
      <main className="mx-auto flex max-w-6xl justify-center px-4 py-16">
        <div
          className={`${card} w-full max-w-md text-center`}
        >
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-3xl shadow-lg shadow-indigo-500/30">
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 opacity-50 blur-lg" />
            <span className="relative">🧭</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight dark:text-white">
            Sign in to use Compass
          </h1>
          <p className="mt-2 mb-6 text-sm text-gray-500">
            Create a free account to compare your résumé with any role.
          </p>
          <AuthForms onAuthSuccess={() => window.location.reload()} />
        </div>
      </main>
    );
  return <CompassWorkspace user={user} />;
}

function CompassWorkspace({ user: _user }: { user: AuthUser }) {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [report, setReport] = useState<CompassReport | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  async function runAnalysis() {
    if (!resume.trim() || !jd.trim()) return;
    setLoading(true);
    setError("");
    setUpgradeRequired(false);
    try {
      const result = await analyzeCompass({
        data: {
          resumeText: resume,
          jobDescription: jd,
          jobTitle: title,
          company,
        },
      });
      if (result.success) {
        setReport(result.report);
        setTruncated(result.truncated);
      } else {
        setError(result.error);
        setUpgradeRequired(!!result.upgradeRequired);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function readFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setResume(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
          🧭 JobVaro Compass
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Your real odds, before you apply
        </h1>
        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/30">
          <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Why you can trust the score
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Compass is built on JobVaro&apos;s proprietary scoring methodology,
            developed from HRKyle Services&apos; everyday work hiring and
            screening real candidates in the field. It doesn&apos;t guess — it
            weighs the same factors AI-based and automated screening tools
            actually look for: required qualifications, relevant experience,
            skills, résumé evidence, and recruiter/ATS readiness. It separates
            must-haves from wish-list items, gives transferable skills fair
            credit, and flags genuine gaps instead of hiding them. And it never
            inflates: when a role isn&apos;t a strong fit, Compass says so
            plainly — and shows you exactly how to close the distance.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.35fr)]">
        {/* ── Input panel ── */}
        <section className={`${card} h-fit lg:sticky lg:top-24`}>
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold tracking-tight dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-500 text-sm text-white shadow-md shadow-indigo-500/25">
              📄
            </span>
            Compare your fit
          </h2>

          <label className="mb-1.5 block text-sm font-medium dark:text-gray-200">
            Job Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            rows={8}
            className={`${input} resize-y`}
            placeholder="Paste the full job description..."
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium dark:text-gray-200">
              Job Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${input} mt-1.5`}
                placeholder="Optional"
              />
            </label>
            <label className="text-sm font-medium dark:text-gray-200">
              Company
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={`${input} mt-1.5`}
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium dark:text-gray-200">
                Paste your résumé <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-gray-400">
                {resume ? `${resume.length.toLocaleString()} chars` : ""}
              </span>
            </div>
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              rows={10}
              className={`${input} resize-y`}
              placeholder="Paste résumé text here…"
            />
            {/* File upload dropzone */}
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm font-medium text-gray-600 transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/30">
              <svg
                className="h-5 w-5 text-indigo-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Upload a TXT file
              <input
                type="file"
                accept=".txt"
                onChange={readFile}
                className="hidden"
              />
            </label>
          </div>

          {(jd.length > 8000 || resume.length > 8000) && (
            <p className="mt-2 text-xs text-amber-600">
              Long inputs will be trimmed to 8,000 characters for analysis.
            </p>
          )}

          {error && (
            <div
              className={`mt-4 rounded-lg p-3 text-sm ${
                upgradeRequired
                  ? "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              }`}
            >
              {error}
            </div>
          )}

          {upgradeRequired ? (
            <div className="mt-5 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-6 text-center dark:border-indigo-800 dark:from-indigo-950/60 dark:to-violet-950/40">
              <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-2xl shadow-lg shadow-indigo-500/30">
                <span className="relative">🧭</span>
              </div>
              <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                You&apos;ve used your free analysis
              </h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                Upgrade to Pro for unlimited AI résumé–job matching — know your
                odds on every application, not just the first few.
              </p>
              <a
                href="/plans"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-3 font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110"
              >
                Upgrade to Pro
              </a>
              <p className="mt-3 text-xs text-gray-400">
                One-time purchase · no auto-renewal
              </p>
            </div>
          ) : (
            <button
              disabled={!jd.trim() || !resume.trim() || loading}
              onClick={runAnalysis}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-3 font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {loading
                ? "Analyzing your fit..."
                : report
                  ? "Analyze Again"
                  : "Analyze Match"}
            </button>
          )}
        </section>

        {/* ── Report panel ── */}
        <section
          className={`${card} min-h-[500px] lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto`}
        >
          {report ? (
            <Report
              report={report}
              truncated={truncated}
              title={title}
              company={company}
            />
          ) : (
            <div className="flex min-h-[480px] flex-col items-center justify-center text-center text-gray-400">
              <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-6xl shadow-lg shadow-indigo-500/25">
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 opacity-40 blur-xl" />
                <span className="relative">🧭</span>
              </div>
              <h2 className="text-xl font-bold text-gray-600 dark:text-gray-300">
                Your match report awaits
              </h2>
              <p className="mt-2 max-w-sm text-sm">
                Add a job description and résumé to see your score, recruiter
                perspective, and an actionable improvement plan.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// ── Score gauge with glow ────────────────────────────────────────────────────

function Gauge({ score }: { score: number }) {
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  const circumference = 2 * Math.PI * 56;
  return (
    <div className="relative h-40 w-40 shrink-0">
      {/* Glow behind the ring */}
      <div
        className="absolute inset-2 rounded-full blur-2xl opacity-30"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <svg className="relative h-full w-full -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r="56"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-gray-200 dark:text-gray-800"
        />
        <circle
          cx="64"
          cy="64"
          r="56"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {score}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          match score
        </span>
      </span>
    </div>
  );
}

// ── Tabs for the report sections ─────────────────────────────────────────────

const TABS = [
  { key: "overview", label: "Overview", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { key: "categories", label: "Breakdown", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "perspectives", label: "Perspectives", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { key: "ats", label: "ATS", icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9z" },
  { key: "recommendations", label: "Improve", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { key: "interpretation", label: "Job Post", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { key: "action", label: "Action Plan", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Report({
  report: r,
  truncated,
  title,
  company,
}: {
  report: CompassReport;
  truncated: boolean;
  title: string;
  company: string;
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const color = r.matchScore >= 80 ? "#16a34a" : r.matchScore >= 60 ? "#d97706" : "#dc2626";

  const tracker = () => {
    const params = new URLSearchParams({
      title,
      company,
      description: "Compass analysis for " + (title || "this role"),
    });
    window.location.href = `/track?${params}`;
  };

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="flex flex-col items-center gap-6 border-b border-gray-200 pb-6 dark:border-gray-800 sm:flex-row">
        <Gauge score={r.matchScore} />
        <div className="text-center sm:text-left">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
            style={{ color, backgroundColor: `${color}18` }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            {r.overallRating}
          </span>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            {r.summary}
          </p>
          <p className="mt-2 text-xs font-semibold text-gray-500">
            Candidate Fit: {r.candidateFit}/75 · Resume Effectiveness:{" "}
            {r.resumeEffectiveness}/25
          </p>
        </div>
      </div>

      {truncated && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Your input was trimmed to 8,000 characters for this analysis.
        </p>
      )}

      {/* Tab bar */}
      <div className="nice-scroll flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              tab === t.key
                ? "bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-sm shadow-indigo-500/30"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={tab} className="animate-page-fade space-y-6">
        {tab === "overview" && (
          <>
            <div
              className={`rounded-xl border p-4 ${
                r.shouldApply
                  ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                  : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
              }`}
            >
              <h3
                className={`flex items-center gap-2 font-bold ${
                  r.shouldApply
                    ? "text-green-700 dark:text-green-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {r.shouldApply ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
                {r.shouldApply
                  ? "You should apply"
                  : "Consider strengthening your fit first"}
              </h3>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {r.applyRationale}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Quote
                title="Recruiter Perspective"
                text={r.recruiterPerspective}
              />
              <Quote
                title="Hiring Manager Perspective"
                text={r.hiringManagerPerspective}
              />
            </div>
          </>
        )}

        {tab === "categories" && (
          <Block title="Category Breakdown">
            <div className="space-y-4">
              {(
                [
                  ["Qualifications Alignment", r.categoryScores.qualifications, 25, "from-indigo-600 to-indigo-400"],
                  ["Relevant Experience", r.categoryScores.experience, 30, "from-violet-600 to-violet-400"],
                  ["Skills & Capability Match", r.categoryScores.skills, 20, "from-blue-600 to-sky-400"],
                  ["Resume Evidence & Positioning", r.categoryScores.resumeEvidence, 15, "from-amber-500 to-amber-400"],
                  ["Recruiter & ATS Readiness", r.categoryScores.atsReadiness, 10, "from-emerald-600 to-emerald-400"],
                ] as [string, number, number, string][]
              ).map(([label, score, max, grad]) => (
                <div key={label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-medium dark:text-gray-300">
                    <span>{label}</span>
                    <span className="font-bold">
                      {score}
                      <span className="font-normal text-gray-400">/{max}</span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-700`}
                      style={{ width: `${Math.min(100, (score / max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Block>
        )}

        {tab === "perspectives" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Quote title="Recruiter Perspective" text={r.recruiterPerspective} />
            <Quote title="Hiring Manager Perspective" text={r.hiringManagerPerspective} />
          </div>
        )}

        {tab === "ats" && (
          <Block title="ATS Analysis">
            <Tags
              label="Present terms"
              values={r.atsAnalysis.presentTerms}
              cls="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
            />
            <Tags
              label="Missing terms"
              values={r.atsAnalysis.missingTerms}
              cls="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
            />
            <Tags
              label="Formatting risks"
              values={r.atsAnalysis.formattingRisks}
              cls="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            />
          </Block>
        )}

        {tab === "recommendations" && (
          <Block title="Recommendations">
            <div className="space-y-4">
              {(
                [
                  ["Already Have But Buried", r.recommendations.alreadyHaveButBuried, "text-green-600 dark:text-green-400"],
                  ["Likely Have Should Add", r.recommendations.likelyHaveShouldAdd, "text-amber-600 dark:text-amber-400"],
                  ["Genuinely Missing", r.recommendations.genuinelyMissing, "text-red-600 dark:text-red-400"],
                ] as [string, string[], string][]
              ).map(([name, items, dot]) => (
                <div key={name}>
                  <h4 className={`mb-2 flex items-center gap-2 text-sm font-bold ${dot}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {name}
                  </h4>
                  {items.length > 0 ? (
                    <ul className="space-y-1.5 pl-5 text-sm text-gray-600 marker:text-gray-300 dark:text-gray-400 [&>li]:list-disc">
                      {items.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">None identified</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Only add skills you genuinely have—never claim experience you
              don&apos;t.
            </p>
          </Block>
        )}

        {tab === "interpretation" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Block title="True requirements">
              <List items={r.jobPostInterpretation.trueRequirements} />
            </Block>
            <Block title="Wish-list items">
              <List items={r.jobPostInterpretation.wishListItems} />
            </Block>
          </div>
        )}

        {tab === "action" && (
          <Block title="Action Plan">
            <ol className="space-y-2.5">
              {r.actionPlan.map((x, i) => (
                <li key={x} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-500 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{x}</span>
                </li>
              ))}
            </ol>
          </Block>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-gray-200 pt-5 dark:border-gray-800">
        <button
          onClick={tracker}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-3 font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110"
        >
          Add to Tracker
        </button>
      </div>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-3 text-base font-bold tracking-tight text-gray-900 dark:text-white">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Quote({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border-l-4 border-indigo-400 bg-gray-50 p-4 dark:bg-gray-950">
      <h3 className="mb-2 text-sm font-bold dark:text-white">{title}</h3>
      <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
        &ldquo;{text}&rdquo;
      </p>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 [&>li]:list-disc [&>li]:pl-1">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

function Tags({
  label,
  values,
  cls,
}: {
  label: string;
  values: string[];
  cls: string;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-semibold text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.length ? (
          values.map((x) => (
            <span
              key={x}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
            >
              {x}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400">None identified</span>
        )}
      </div>
    </div>
  );
}

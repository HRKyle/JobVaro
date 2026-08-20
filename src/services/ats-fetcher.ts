/**
 * Free ATS job fetcher.
 * Fetches real job listings from Greenhouse, Lever, and other free ATS APIs.
 * All external API calls happen server-side only via createServerFn.
 */
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { COMPANIES, getCompanyBySlug, type CompanyEntry } from "~/data/companies";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ATSJob {
  external_id: string;
  title: string;
  company: string;
  company_slug: string;
  location: string;
  description: string;
  url: string;
  salary: string;
  source: string;
  posted_at: string | null;
}

const FETCH_TIMEOUT_MS = 10_000;

// ── fetchWithTimeout ─────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

// ── Greenhouse fetcher ───────────────────────────────────────────────────────

async function fetchGreenhouse(company: string): Promise<ATSJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`;
  const resp = await fetchWithTimeout(url);
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    jobs?: Array<{
      id: number;
      title: string;
      company_name?: string;
      location?: { name?: string };
      absolute_url?: string;
      metadata?: Array<{ name: string; value: string }>;
      content?: string;
      updated_at?: string;
    }>;
  };
  if (!data.jobs) return [];

  return data.jobs.map((job) => {
    const salaryMeta = job.metadata?.find((m) =>
      m.name?.toLowerCase().includes("salary") || m.name?.toLowerCase().includes("compensation")
    );
    return {
      external_id: `gh:${company}:${job.id}`,
      title: job.title ?? "Untitled",
      company: job.company_name ?? company,
      company_slug: company,
      location: job.location?.name ?? "Remote",
      description: job.content ?? "",
      url: job.absolute_url ?? `https://boards.greenhouse.io/${company}/jobs/${job.id}`,
      salary: salaryMeta?.value ?? "",
      source: "greenhouse",
      posted_at: job.updated_at ?? null,
    };
  });
}

// ── Lever fetcher ────────────────────────────────────────────────────────────

async function fetchLever(company: string): Promise<ATSJob[]> {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
  const resp = await fetchWithTimeout(url);
  if (!resp.ok) return [];
  const data = (await resp.json()) as Array<{
    id: string;
    text: string;
    categories?: { team?: string; location?: string; commitment?: string };
    hostedUrl?: string;
    applyUrl?: string;
    descriptionPlain?: string;
    createdAt?: number;
    additionalPlain?: string;
  }>;

  if (!Array.isArray(data)) return [];

  return data.map((job) => ({
    external_id: `lever:${company}:${job.id}`,
    title: job.text ?? "Untitled",
    company,
    company_slug: company,
    location: job.categories?.location ?? "Remote",
    description: job.descriptionPlain ?? job.additionalPlain ?? "",
    url: job.hostedUrl ?? job.applyUrl ?? `https://jobs.lever.co/${company}/${job.id}`,
    salary: "",
    source: "lever",
    posted_at: job.createdAt ? new Date(job.createdAt).toISOString() : null,
  }));
}

// ── fetchCompanyJobs ─────────────────────────────────────────────────────────

async function fetchCompanyJobsImpl(companySlug: string, companyName: string): Promise<ATSJob[]> {
  const company = getCompanyBySlug(companySlug);
  if (!company) return [];

  try {
    if (company.ats === "greenhouse") {
      return await fetchGreenhouse(companySlug);
    }
    if (company.ats === "lever") {
      return await fetchLever(companySlug);
    }
  } catch (err) {
    console.error(`Error fetching ${companySlug}:`, err);
  }

  return [];
}

// ── Single-company fetch + upsert (shared helper) ────────────────────────────

/**
 * Fetch jobs for a single company (if it has a known ATS feed) and upsert them
 * into jobs_feed. Returns the number of jobs upserted (0 for none / no feed).
 * Used by both followCompany (fetch-on-follow) and the parallel feed refresh.
 */
export async function fetchAndUpsertCompanyJobs(slug: string, name: string): Promise<number> {
  const company = getCompanyBySlug(slug);
  if (!company || company.ats === "none") return 0;

  const jobs = await fetchCompanyJobsImpl(slug, name);
  if (jobs.length === 0) return 0;

  for (const job of jobs) {
    await sql`
      INSERT INTO jobs_feed (external_id, title, company, company_slug, location, description, url, salary, source, posted_at)
      VALUES (
        ${job.external_id},
        ${job.title},
        ${job.company},
        ${job.company_slug},
        ${job.location},
        ${job.description},
        ${job.url},
        ${job.salary},
        ${job.source},
        ${job.posted_at ? new Date(job.posted_at).toISOString() : null}
      )
      ON CONFLICT (external_id) DO UPDATE SET
        title = EXCLUDED.title,
        location = EXCLUDED.location,
        description = EXCLUDED.description,
        url = EXCLUDED.url,
        salary = EXCLUDED.salary,
        posted_at = EXCLUDED.posted_at,
        fetched_at = now()
    `;
  }
  return jobs.length;
}

// ── In-flight refresh guard ───────────────────────────────────────────────────

let refreshInFlight: Promise<{ total: number; companies: number }> | null = null;

/**
 * True when a background feed refresh is currently running. Used by the search
 * page to show a subtle "refreshing" indicator without blocking.
 */
export function isRefreshInFlight(): boolean {
  return refreshInFlight !== null;
}

/**
 * Kick off a background refresh of all watchlist jobs if one isn't already
 * running. Fire-and-forget: never throws to the caller. Returns whether this
 * call started a refresh (as opposed to reusing an already-running one).
 */
export function triggerFeedRefresh(): { started: boolean } {
  if (refreshInFlight) return { started: false };
  refreshInFlight = refreshJobsFeedImpl().finally(() => {
    refreshInFlight = null;
  });
  return { started: true };
}

// ── Exported server functions ────────────────────────────────────────────────

/**
 * Fetch jobs for a single company.
 */
export const fetchCompanyJobs = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<{ jobs: ATSJob[]; error?: string }> => {
    const { companySlug, companyName } = data as { companySlug: string; companyName: string };
    if (!companySlug || !companyName) return { jobs: [], error: "Invalid params." };

    try {
      const jobs = await fetchCompanyJobsImpl(companySlug, companyName);
      return { jobs };
    } catch (err) {
      return { jobs: [], error: "Fetch failed." };
    }
  },
);

/**
 * Fetch jobs for all companies that have known ATS feeds across the whole watchlist.
 * Skips companies fetched in the last hour. Concurrent with a small concurrency cap.
 */
export const fetchAllWatchlistJobs = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ total: number; companies: number }> => {
    return refreshJobsFeedImpl();
  },
);

/**
 * Refresh jobs feed — fetches all watchlist company jobs concurrently.
 * Meant to be called periodically (e.g., via cron or manual trigger).
 */
export const refreshJobsFeed = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ total: number; companies: number }> => {
    return refreshJobsFeedImpl();
  },
);

/**
 * Non-server-fn implementation of refreshJobsFeed for use within other server functions.
 * Fetches jobs for all followed companies with known ATS feeds and upserts into jobs_feed.
 * Respects the 1-hour cache (skips companies fetched within the last hour).
 *
 * The per-company fetches run CONCURRENTLY with a small concurrency cap so that a large
 * watchlist refreshes in a reasonable time instead of sequentially one-at-a-time.
 */
const REFRESH_CONCURRENCY = 5;

export async function refreshJobsFeedImpl(): Promise<{ total: number; companies: number }> {
  try {
    // Get all unique followed companies
    const rows = await sql`
      SELECT DISTINCT w.company_slug, w.company_name
      FROM company_watchlist w
      ORDER BY w.company_name
    `;

    // Filter to only those with known ATS feeds
    const atsSlugs = new Set(COMPANIES.filter((c) => c.ats !== "none").map((c) => c.slug));
    const filteredRows = rows
      .map((row) => ({
        slug: String((row as Record<string, unknown>).company_slug),
        name: String((row as Record<string, unknown>).company_name),
      }))
      .filter(({ slug }) => atsSlugs.has(slug));

    // Simple concurrency pool: at most REFRESH_CONCURRENCY companies fetched at once,
    // each still respecting the once-per-hour throttle.
    let total = 0;
    let companyCount = 0;
    let cursor = 0;

    async function worker() {
      while (cursor < filteredRows.length) {
        const item = filteredRows[cursor++];
        const { slug, name } = item;
        try {
          // Throttle: skip if this company was fetched within the last hour.
          const lastFetch = await sql`
            SELECT fetched_at FROM jobs_feed
            WHERE company_slug = ${slug}
            ORDER BY fetched_at DESC LIMIT 1
          `;
          if (lastFetch.length > 0) {
            const lastTime = new Date(String((lastFetch[0] as Record<string, unknown>).fetched_at));
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            if (lastTime > oneHourAgo) continue; // Skip if fetched within last hour
          }

          const fetched = await fetchAndUpsertCompanyJobs(slug, name);
          if (fetched > 0) {
            total += fetched;
            companyCount++;
          }
        } catch (err) {
          console.error(`refreshJobsFeedImpl error for ${slug}:`, err);
        }
      }
    }

    const workerCount = Math.min(REFRESH_CONCURRENCY, Math.max(1, filteredRows.length));
    await Promise.all(Array.from({ length: workerCount }, worker));

    return { total, companies: companyCount };
  } catch (err) {
    console.error("refreshJobsFeedImpl error:", err);
    return { total: 0, companies: 0 };
  }
}

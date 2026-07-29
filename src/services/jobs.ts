/**
 * Job search and save/unsave server functions.
 * All data access is through server functions — never exposed to the client.
 */

import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { refreshJobsFeedImpl } from "~/services/ats-fetcher";

// ── Types ────────────────────────────────────────────────────────────────────

export interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string | null;
  source: string | null;
  salary: string | null;
  posted_at: string | null;
  saved_at: string | null;
  is_saved: boolean;
}

export interface SearchParams {
  search?: string;
  source?: string;
  location?: string;
  sort?: "newest" | "oldest" | "company";
  page?: number;
  filter?: "all" | "watchlist";
}

export interface SearchResponse {
  jobs: JobResult[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function serializeJob(row: Record<string, unknown>, savedJobIds: Set<string>): JobResult {
  return {
    id: String(row.id),
    title: String(row.title),
    company: String(row.company),
    location: row.location ? String(row.location) : null,
    description: row.description ? String(row.description) : null,
    url: row.url ? String(row.url) : null,
    source: row.source ? String(row.source) : null,
    salary: row.salary ? String(row.salary) : null,
    posted_at: row.posted_at ? String(row.posted_at) : null,
    saved_at: row.saved_at ? String(row.saved_at) : null,
    is_saved: savedJobIds.has(String(row.id)),
  };
}

// ── searchJobs ───────────────────────────────────────────────────────────────

export const searchJobs = createServerFn({ method: "GET" }).handler(
  async ({ data }): Promise<SearchResponse> => {
    const params = (data ?? {}) as SearchParams;
    const search = params.search?.trim() || "";
    const source = params.source?.trim() || "";
    const location = params.location?.trim() || "";
    const sort = params.sort || "newest";
    const page = Math.max(1, params.page ?? 1);
    const perPage = 20;
    const offset = (page - 1) * perPage;
    const filter = params.filter || "all";

    try {
      // Get current user (if logged in) to check saved status and watchlist
      let savedJobIds = new Set<string>();
      let userId: string | null = null;
      let watchlistSlugs: string[] = [];

      try {
        const { getCookie } = await import("@tanstack/react-start/server");
        const token = getCookie("jobhub_session");
        if (token) {
          const sess = await sql`
            SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
          `;
          if (sess.length > 0) {
            const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
            if (new Date(expires_at) >= new Date()) {
              userId = user_id;
              const saved = await sql`
                SELECT id FROM saved_jobs WHERE user_id = ${user_id}
              `;
              for (const row of saved) {
                savedJobIds.add(String(row.id));
              }
              // Get watchlist slugs
              const wl = await sql`
                SELECT company_slug FROM company_watchlist WHERE user_id = ${user_id}
              `;
              watchlistSlugs = wl.map((r) => String((r as Record<string, unknown>).company_slug));
            }
          }
        }
      } catch {
        // If session check fails, just carry on without saved status
      }

      // Build ORDER BY
      let orderClause: string;
      if (sort === "oldest") {
        orderClause = "ORDER BY posted_at ASC NULLS LAST";
      } else if (sort === "company") {
        orderClause = "ORDER BY company ASC NULLS LAST";
      } else {
        orderClause = "ORDER BY posted_at DESC NULLS LAST";
      }

      // For watchlist filter, build a UNION query across all three job sources
      if (filter === "watchlist" && watchlistSlugs.length > 0) {
        // Check if jobs_feed has any data for these watchlist companies.
        // If empty, await the refresh so the user gets results on first visit.
        const slugPhCheck: string[] = [];
        const checkParams: string[] = [];
        let cpid = 1;
        for (const s of watchlistSlugs) {
          slugPhCheck.push("$" + cpid);
          checkParams.push(s);
          cpid++;
        }
        const feedCount = await sql(
          "SELECT COUNT(*) as ct FROM jobs_feed WHERE company_slug IN (" + slugPhCheck.join(", ") + ")",
          ...checkParams
        );
        const hasFeed = Number((feedCount[0] as Record<string, unknown>).ct) > 0;

        if (!hasFeed) {
          // First visit or empty feed — await the refresh synchronously
          try {
            await refreshJobsFeedImpl();
          } catch (err) {
            console.error("Initial jobs feed refresh failed:", err);
          }
        } else {
          // Already have data — fire-and-forget to keep it fresh
          refreshJobsFeedImpl().catch((err) => {
            console.error("Auto-refresh jobs feed failed:", err);
          });
        }
        const qparams: string[] = [];
        let pid = 1;

        const searchCondition = search
          ? " AND (title ILIKE $" + pid + " OR company ILIKE $" + pid + " OR description ILIKE $" + pid + " OR location ILIKE $" + pid + ")"
          : "";
        if (search) { qparams.push("%" + search + "%"); pid++; }

        const locationCondition = location
          ? " AND location ILIKE $" + pid
          : "";
        if (location) { qparams.push("%" + location + "%"); pid++; }

        const sourceCondition = source
          ? " AND source = $" + pid
          : "";
        if (source) { qparams.push(source); pid++; }

        // Build company slugs condition
        const slugPh: string[] = [];
        for (const s of watchlistSlugs) {
          slugPh.push("$" + pid);
          qparams.push(s);
          pid++;
        }
        const slugCondition = " AND company_slug IN (" + slugPh.join(", ") + ")";

        // For saved_jobs/community_jobs match by company name
        const namePh: string[] = [];
        for (const s of watchlistSlugs) {
          namePh.push("$" + pid);
          qparams.push(s.replace(/-/g, " ").toLowerCase());
          pid++;
        }
        const companyNamesCondition = " AND LOWER(company) IN (" + namePh.join(", ") + ")";

        const unionQuery =
          "SELECT id, title, company, location, description, url, source, salary, posted_at, NULL::timestamptz as saved_at " +
          "FROM jobs_feed WHERE 1=1" + slugCondition + searchCondition + locationCondition + sourceCondition + " " +
          "UNION ALL " +
          "SELECT id, title, company, location, description, url, source, salary, posted_at, saved_at " +
          "FROM saved_jobs WHERE 1=1" + companyNamesCondition + searchCondition + locationCondition + sourceCondition + " " +
          "UNION ALL " +
          "SELECT id, title, company, location, description, url, source, salary, posted_at, NULL::timestamptz as saved_at " +
          "FROM community_jobs WHERE 1=1" + companyNamesCondition + searchCondition + locationCondition + sourceCondition;

        // Count total
        const countQuery = "SELECT COUNT(*) as total FROM (" + unionQuery + ") sub";
        const countResult = await sql(countQuery, ...qparams);
        const total = Number((countResult[0] as Record<string, unknown>).total);

        // Fetch page with ordering
        const dataQuery =
          "SELECT * FROM (" + unionQuery + ") sub " +
          orderClause + " " +
          "LIMIT " + perPage + " OFFSET " + offset;
        const rows = await sql(dataQuery, ...qparams);

        const jobs = rows.map((row) => serializeJob(row as Record<string, unknown>, savedJobIds));

        return { jobs, total, page, perPage, totalPages: Math.ceil(total / perPage) };
      }

      // Standard search across saved_jobs
      const conditions: string[] = [];
      const qparams: string[] = [];
      let pid = 1;

      if (search) {
        conditions.push(
          "(title ILIKE $" + pid + " OR company ILIKE $" + pid + " OR description ILIKE $" + pid + " OR location ILIKE $" + pid + ")",
        );
        qparams.push("%" + search + "%");
        pid++;
      }

      if (source) {
        conditions.push("source = $" + pid);
        qparams.push(source);
        pid++;
      }

      if (location) {
        conditions.push("location ILIKE $" + pid);
        qparams.push("%" + location + "%");
        pid++;
      }

      const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

      // Count total
      const countQuery = "SELECT COUNT(*) as total FROM saved_jobs " + whereClause;
      const countResult = await sql(countQuery, ...qparams);
      const total = Number((countResult[0] as Record<string, unknown>).total);

      // Fetch page
      const dataQuery =
        "SELECT id, title, company, location, description, url, source, salary, posted_at, saved_at " +
        "FROM saved_jobs " + whereClause + " " + orderClause + " " +
        "LIMIT " + perPage + " OFFSET " + offset;
      const rows = await sql(dataQuery, ...qparams);

      const jobs = rows.map((row) => serializeJob(row as Record<string, unknown>, savedJobIds));

      return {
        jobs,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      };
    } catch (err) {
      console.error("searchJobs error:", err);
      return {
        jobs: [],
        total: 0,
        page: 1,
        perPage,
        totalPages: 0,
      };
    }
  },
);

// ── getDistinctSources ───────────────────────────────────────────────────────

export const getDistinctSources = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const rows = await sql`
      SELECT DISTINCT source FROM saved_jobs WHERE source IS NOT NULL ORDER BY source
    `;
    return rows.map((r) => String((r as Record<string, unknown>).source));
  } catch {
    return [] as string[];
  }
});

// ── getDistinctLocations ─────────────────────────────────────────────────────

export const getDistinctLocations = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const rows = await sql`
      SELECT DISTINCT location FROM saved_jobs WHERE location IS NOT NULL ORDER BY location
    `;
    return rows.map((r) => String((r as Record<string, unknown>).location));
  } catch {
    return [] as string[];
  }
});

// ── saveJob ──────────────────────────────────────────────────────────────────

export const saveJob = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return { success: false, error: "You must be logged in to save jobs." };

    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return { success: false, error: "You must be logged in to save jobs." };
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return { success: false, error: "You must be logged in to save jobs." };

    const job = data as {
      title: string;
      company: string;
      location?: string;
      description?: string;
      url?: string;
      source?: string;
      salary?: string;
      posted_at?: string;
      external_id?: string;
    };

    try {
      // Check if already saved (by user_id + title + company to avoid exact dups)
      const existing = await sql`
        SELECT id FROM saved_jobs
        WHERE user_id = ${user_id}
          AND title = ${job.title}
          AND company = ${job.company}
        LIMIT 1
      `;
      if (existing.length > 0) {
        return { success: true }; // Already saved, treat as success
      }

      await sql`
        INSERT INTO saved_jobs (user_id, title, company, location, description, url, source, salary, posted_at, external_id)
        VALUES (
          ${user_id},
          ${job.title},
          ${job.company},
          ${job.location ?? null},
          ${job.description ?? null},
          ${job.url ?? null},
          ${job.source ?? null},
          ${job.salary ?? null},
          ${job.posted_at ? new Date(job.posted_at).toISOString() : null},
          ${job.external_id ?? null}
        )
      `;

      return { success: true };
    } catch (err) {
      console.error("saveJob error:", err);
      return { success: false, error: "Failed to save job." };
    }
  },
);

// ── unsaveJob ────────────────────────────────────────────────────────────────

export const unsaveJob = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return { success: false, error: "You must be logged in." };

    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return { success: false, error: "You must be logged in." };
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return { success: false, error: "You must be logged in." };

    const { jobId } = data as { jobId: string };

    try {
      await sql`
        DELETE FROM saved_jobs
        WHERE id = ${jobId} AND user_id = ${user_id}
      `;
      return { success: true };
    } catch (err) {
      console.error("unsaveJob error:", err);
      return { success: false, error: "Failed to unsave job." };
    }
  },
);

// ── getSavedJobs ─────────────────────────────────────────────────────────────

export const getSavedJobs = createServerFn({ method: "GET" }).handler(
  async (): Promise<JobResult[]> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return [];

    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return [];
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return [];

    try {
      const rows = await sql`
        SELECT id, title, company, location, description, url, source, salary, posted_at, saved_at
        FROM saved_jobs
        WHERE user_id = ${user_id}
        ORDER BY saved_at DESC
      `;
      const savedIds = new Set(rows.map((r) => String((r as Record<string, unknown>).id)));
      return rows.map((row) => serializeJob(row as Record<string, unknown>, savedIds));
    } catch {
      return [];
    }
  },
);

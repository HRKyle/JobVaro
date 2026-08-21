/**
 * Company watchlist server functions.
 * searchCompanies, followCompany, unfollowCompany, getWatchlist, getAllFollowedCompanies.
 */
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { searchCompanies as searchCompanyList, getCompanyBySlug, type CompanyEntry } from "~/data/companies";
import { fetchAndUpsertCompanyJobs } from "~/services/ats-fetcher";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  try {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return null;
    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return null;
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return null;
    return user_id;
  } catch (err) {
    console.error("getUserId error (companies service):", err);
    return null;
  }
}

// ── searchCompanies (server fn wrapping the data list) ───────────────────────

export const searchCompanies = createServerFn({ method: "GET" }).handler(
  async ({ data }): Promise<{ companies: CompanyEntry[]; followed: string[] }> => {
    const query = (data as { query?: string } | undefined)?.query ?? "";
    const results = searchCompanyList(query);
    const userId = await getUserId();
    let followed: string[] = [];
    if (userId) {
      try {
        const rows = await sql`
          SELECT company_slug FROM company_watchlist WHERE user_id = ${userId}
        `;
        followed = rows.map((r) => String((r as Record<string, unknown>).company_slug));
      } catch {
        // ignore
      }
    }
    return { companies: results, followed };
  },
);

// ── followCompany ────────────────────────────────────────────────────────────

export interface FollowResult {
  success: boolean;
  error?: string;
  /** Number of jobs fetched & stored for this company right after following (0 if the feed is empty/unreachable). */
  jobsFetched?: number;
}

/**
 * Follow a curated, feed-backed company by slug (Option B).
 *
 * The watchlist may ONLY contain companies that auto-pull live jobs from a
 * public ATS feed (Greenhouse / Lever / SmartRecruiters / Ashby). Free-text /
 * arbitrary company names are NOT accepted — a company with no public feed is
 * not followable. On follow, jobs are fetched immediately into jobs_feed
 * (fetch-on-follow) and the count is reported.
 */
export const followCompany = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<FollowResult> => {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "You must be logged in." };

    const { companySlug } = data as { companySlug?: string };
    const slug = companySlug?.trim();
    if (!slug) return { success: false, error: "Company is required." };

    // Option B: only curated, feed-backed companies are followable.
    const curated = getCompanyBySlug(slug);
    if (!curated) return { success: false, error: "Company not found." };
    if (curated.ats === "none") {
      return { success: false, error: "This company does not publish an auto-trackable job feed." };
    }

    const finalSlug = curated.slug;
    const finalName = curated.name;

    try {
      await sql`
        INSERT INTO company_watchlist (user_id, company_slug, company_name)
        VALUES (${userId}, ${finalSlug}, ${finalName})
        ON CONFLICT (user_id, company_slug) DO NOTHING
      `;
    } catch (err) {
      console.error("followCompany error:", err);
      return { success: false, error: "Failed to follow company." };
    }

    // Fetch-on-follow: pull this company's jobs immediately. Degrades
    // gracefully — the follow itself always succeeds even if the feed is empty.
    let jobsFetched = 0;
    try {
      jobsFetched = await fetchAndUpsertCompanyJobs(finalSlug, finalName);
    } catch (err) {
      console.error(`followCompany: background fetch for ${finalSlug} failed:`, err);
    }

    return { success: true, jobsFetched };
  },
);

// ── unfollowCompany ──────────────────────────────────────────────────────────

export const unfollowCompany = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "You must be logged in." };

    const { companySlug } = data as { companySlug: string };
    if (!companySlug) return { success: false, error: "Company slug is required." };

    try {
      await sql`
        DELETE FROM company_watchlist
        WHERE user_id = ${userId} AND company_slug = ${companySlug}
      `;
      return { success: true };
    } catch (err) {
      console.error("unfollowCompany error:", err);
      return { success: false, error: "Failed to unfollow company." };
    }
  },
);

// ── getWatchlist ─────────────────────────────────────────────────────────────

export const getWatchlist = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ companies: CompanyEntry[] }> => {
    const userId = await getUserId();
    if (!userId) return { companies: [] };

    try {
      const rows = await sql`
        SELECT company_slug, company_name FROM company_watchlist
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      const companies = rows.map((r) => {
        const row = r as Record<string, unknown>;
        const slug = String(row.company_slug);
        const found = getCompanyBySlug(slug);
        return {
          name: String(row.company_name),
          slug,
          ats: found?.ats ?? "none" as CompanyEntry["ats"],
        };
      });
      return { companies };
    } catch {
      return { companies: [] };
    }
  },
);

// ── getAllFollowedCompanies ──────────────────────────────────────────────────

export const getAllFollowedCompanies = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ companies: { slug: string; name: string }[] }> => {
    try {
      const rows = await sql`
        SELECT DISTINCT company_slug, company_name FROM company_watchlist
        ORDER BY company_name
      `;
      return {
        companies: rows.map((r) => ({
          slug: String((r as Record<string, unknown>).company_slug),
          name: String((r as Record<string, unknown>).company_name),
        })),
      };
    } catch {
      return { companies: [] };
    }
  },
);

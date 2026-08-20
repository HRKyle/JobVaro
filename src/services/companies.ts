/**
 * Company watchlist server functions.
 * searchCompanies, followCompany, unfollowCompany, getWatchlist, getAllFollowedCompanies.
 */
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { searchCompanies as searchCompanyList, getCompanyBySlug, type CompanyEntry } from "~/data/companies";
import { fetchAndUpsertCompanyJobs } from "~/services/ats-fetcher";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Slugify a free-text company name, e.g. "HRKyle Services" -> "hrkyle-services". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+|\.+$/g, "");
}

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
  /** Number of jobs fetched & stored for this company right after following (0 for custom/no-ATS). */
  jobsFetched?: number;
}

/**
 * Follow a company. Accepts either a curated slug or an arbitrary free-text
 * company name (Goal B). If the slug/name matches a curated entry we keep its
 * real slug + ATS feed; otherwise we insert it as a custom company with no ATS
 * (label: Manual). For companies with a known ATS feed, we immediately fetch
 * their jobs into jobs_feed (fetch-on-follow) and report the count.
 */
export const followCompany = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<FollowResult> => {
    const userId = await getUserId();
    if (!userId) return { success: false, error: "You must be logged in." };

    const { companySlug, companyName } = data as { companySlug?: string; companyName?: string };
    const name = companyName?.trim();
    const slug = companySlug?.trim() || (name ? slugify(name) : "");
    if (!name && !companySlug) return { success: false, error: "Company name is required." };

    // Resolve to a real curated entry when possible; otherwise treat as custom.
    const resolvedName = name || slug;
    const curated = getCompanyBySlug(slug);
    const finalSlug = curated?.slug ?? slug;
    const finalName = curated?.name ?? resolvedName;
    const ats = curated?.ats ?? "none";

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

    // Fetch-on-follow: for companies with a known ATS feed, pull jobs immediately.
    // Degrades gracefully — the follow itself always succeeds even if the fetch fails.
    let jobsFetched = 0;
    if (ats !== "none") {
      try {
        jobsFetched = await fetchAndUpsertCompanyJobs(finalSlug, finalName);
      } catch (err) {
        console.error(`followCompany: background fetch for ${finalSlug} failed:`, err);
      }
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

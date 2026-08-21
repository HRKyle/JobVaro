/**
 * Community job board server functions.
 * All data access is through server functions — never exposed to the client.
 */

import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { geocodeJobLocation } from "~/services/geocode";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommunityJob {
  id: string;
  user_id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string | null;
  salary: string | null;
  source: string | null;
  posted_at: string;
  user_name: string | null;
}

export interface CommunityJobsResponse {
  jobs: CommunityJob[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ShareJobInput {
  title: string;
  company: string;
  location?: string;
  description?: string;
  url?: string;
  salary?: string;
  source?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function serializeCommunityJob(row: Record<string, unknown>): CommunityJob {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title),
    company: String(row.company),
    location: row.location ? String(row.location) : null,
    description: row.description ? String(row.description) : null,
    url: row.url ? String(row.url) : null,
    salary: row.salary ? String(row.salary) : null,
    source: row.source ? String(row.source) : null,
    posted_at: String(row.posted_at),
    user_name: row.user_name ? String(row.user_name) : null,
  };
}

// ── Helper: get userId from session ──────────────────────────────────────────

async function getUserIdFromSession(): Promise<string | null> {
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
    return String(user_id);
  } catch {
    return null;
  }
}

// ── getCommunityJobs ─────────────────────────────────────────────────────────

export const getCommunityJobs = createServerFn({ method: "GET" }).handler(
  async ({ data }): Promise<CommunityJobsResponse> => {
    const params = (data ?? {}) as { search?: string; page?: number };
    const search = params.search?.trim() || "";
    const page = Math.max(1, params.page ?? 1);
    const perPage = 20;
    const offset = (page - 1) * perPage;

    try {
      const conditions: string[] = [];
      const queryParams: unknown[] = [];
      let paramIdx = 1;

      if (search) {
        conditions.push(
          `(cj.title ILIKE $${paramIdx} OR cj.company ILIKE $${paramIdx} OR cj.description ILIKE $${paramIdx})`,
        );
        queryParams.push(`%${search}%`);
        paramIdx++;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Count total
      const countQuery = `SELECT COUNT(*) as total FROM community_jobs cj ${whereClause}`;
      const countResult = await sql(countQuery, ...queryParams);
      const total = Number((countResult[0] as Record<string, unknown>).total);

      // Fetch page with user name joined
      const dataQuery = `
        SELECT cj.id, cj.user_id, cj.title, cj.company, cj.location,
               cj.description, cj.url, cj.salary, cj.source, cj.posted_at,
               u.name as user_name
        FROM community_jobs cj
        LEFT JOIN users u ON u.id = cj.user_id
        ${whereClause}
        ORDER BY cj.posted_at DESC
        LIMIT ${perPage} OFFSET ${offset}
      `;
      const rows = await sql(dataQuery, ...queryParams);

      const jobs = rows.map((row) =>
        serializeCommunityJob(row as Record<string, unknown>),
      );

      return {
        jobs,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      };
    } catch (err) {
      console.error("getCommunityJobs error:", err);
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

// ── shareJob ─────────────────────────────────────────────────────────────────

export const shareJob = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<{ success: boolean; error?: string; job?: CommunityJob }> => {
    const userId = await getUserIdFromSession();
    if (!userId)
      return { success: false, error: "You must be logged in to share a job." };

    const input = data as ShareJobInput;

    if (!input.title?.trim())
      return { success: false, error: "Job title is required." };
    if (!input.company?.trim())
      return { success: false, error: "Company is required." };

    try {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const coords = await geocodeJobLocation(input.location?.trim() ?? null);
        if (coords) { lat = coords.lat; lng = coords.lng; }
      } catch {
        // ignore — best-effort geocoding
      }
      const rows = await sql`
        INSERT INTO community_jobs (user_id, title, company, location, description, url, salary, source, lat, lng)
        VALUES (
          ${userId},
          ${input.title.trim()},
          ${input.company.trim()},
          ${input.location?.trim() ?? null},
          ${input.description?.trim() ?? null},
          ${input.url?.trim() ?? null},
          ${input.salary?.trim() ?? null},
          ${input.source?.trim() ?? null},
          ${lat},
          ${lng}
        )
        RETURNING id, user_id, title, company, location, description, url, salary, source, posted_at
      `;

      const row = rows[0] as Record<string, unknown>;

      // Fetch the user name for the returned job
      const userRows = await sql`
        SELECT name FROM users WHERE id = ${userId} LIMIT 1
      `;
      const userRow = userRows[0] as Record<string, unknown> | undefined;

      const job = {
        ...serializeCommunityJob(row),
        user_name: userRow?.name ? String(userRow.name) : null,
      };

      return { success: true, job };
    } catch (err) {
      console.error("shareJob error:", err);
      return { success: false, error: "Failed to share job." };
    }
  },
);

// ── deleteCommunityJob ───────────────────────────────────────────────────────

export const deleteCommunityJob = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const userId = await getUserIdFromSession();
    if (!userId)
      return { success: false, error: "You must be logged in." };

    const { id } = data as { id: string };

    if (!id)
      return { success: false, error: "Job ID is required." };

    try {
      // Check ownership
      const existing = await sql`
        SELECT id FROM community_jobs WHERE id = ${id} AND user_id = ${userId} LIMIT 1
      `;
      if (existing.length === 0)
        return { success: false, error: "Job not found or you don't own it." };

      await sql`
        DELETE FROM community_jobs WHERE id = ${id} AND user_id = ${userId}
      `;
      return { success: true };
    } catch (err) {
      console.error("deleteCommunityJob error:", err);
      return { success: false, error: "Failed to delete job." };
    }
  },
);

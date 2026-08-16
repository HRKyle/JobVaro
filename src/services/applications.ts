/**
 * Application tracking server functions.
 * All data access is through server functions — never exposed to the client.
 */

import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { FREE_LIMIT, getGraceStateForUser } from "~/services/plans";

// ── Types ────────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "phone_screen"
  | "interview"
  | "technical"
  | "offer"
  | "accepted"
  | "rejected"
  | "withdrawn";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "saved",
  "applied",
  "phone_screen",
  "interview",
  "technical",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
];

export interface ApplicationEvent {
  id: string;
  application_id: string;
  event_type: string;
  event_date: string;
  notes: string | null;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string | null;
  job_title: string;
  company: string;
  status: ApplicationStatus;
  applied_at: string;
  notes: string | null;
  follow_up_at: string | null;
  updated_at: string;
  event_count: number;
  events: ApplicationEvent[];
  // Optional joined job data
  job_url: string | null;
  job_source: string | null;
}

export interface CreateApplicationInput {
  job_title: string;
  company: string;
  status?: ApplicationStatus;
  notes?: string;
  follow_up_at?: string;
  job_id?: string;
  job_url?: string;
  description?: string;
}

export interface UpdateApplicationInput {
  notes?: string;
  follow_up_at?: string;
  applied_at?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function serializeApplication(
  row: Record<string, unknown>,
  eventCount?: number,
): Application {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    job_id: row.job_id ? String(row.job_id) : null,
    job_title: String(row.job_title),
    company: String(row.company),
    status: String(row.status) as ApplicationStatus,
    applied_at: row.applied_at ? String(row.applied_at) : "",
    notes: row.notes ? String(row.notes) : null,
    follow_up_at: row.follow_up_at ? String(row.follow_up_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : "",
    event_count: eventCount ?? Number(row.event_count ?? 0),
    events: [],
    job_url: (row.job_url as string) ?? (row.url as string) ?? null,
    job_source: row.job_source ? String(row.job_source) : null,
  };
}

function serializeEvent(row: Record<string, unknown>): ApplicationEvent {
  return {
    id: String(row.id),
    application_id: String(row.application_id),
    event_type: String(row.event_type ?? ""),
    event_date: row.event_date ? String(row.event_date) : "",
    notes: row.notes ? String(row.notes) : null,
  };
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ");
}

// ── getApplications ──────────────────────────────────────────────────────────

export const getApplications = createServerFn({ method: "GET" }).handler(
  async (): Promise<Application[]> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return [];

    // Validate session
    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return [];
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return [];

    try {
      // Locking (data-lapse policy): while a user is free AND in grace, only
      // the 5 most recently created applications are visible. Rows stay in the
      // DB — this is a query-level lock.
      const grace = await getGraceStateForUser(user_id);
      const locked = grace.inGrace;

      const rows = locked
        ? await sql`
          SELECT
            a.*,
            COALESCE(
              (SELECT COUNT(*) FROM application_events WHERE application_id = a.id),
              0
            )::int AS event_count,
            sj.url AS job_url,
            sj.source AS job_source
          FROM applications a
          LEFT JOIN saved_jobs sj ON a.job_id = sj.id
          WHERE a.user_id = ${user_id}
          ORDER BY a.created_at DESC
          LIMIT ${FREE_LIMIT}
        `
        : await sql`
          SELECT
            a.*,
            COALESCE(
              (SELECT COUNT(*) FROM application_events WHERE application_id = a.id),
              0
            )::int AS event_count,
            sj.url AS job_url,
            sj.source AS job_source
          FROM applications a
          LEFT JOIN saved_jobs sj ON a.job_id = sj.id
          WHERE a.user_id = ${user_id}
          ORDER BY a.updated_at DESC
        `;

      return (rows as Record<string, unknown>[]).map((row) =>
        serializeApplication(row),
      );
    } catch (err) {
      console.error("getApplications error:", err);
      return [];
    }
  },
);

// ── getApplication ───────────────────────────────────────────────────────────

export const getApplication = createServerFn({ method: "GET" }).handler(
  async ({ data }): Promise<Application | null> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return null;

    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return null;
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return null;

    const { id } = (data ?? {}) as { id: string };

    try {
      // Locking: in grace, only the 5 most recently created applications are
      // reachable — locked ones 404 for the user (rows remain in the DB).
      const grace = await getGraceStateForUser(user_id);
      const locked = grace.inGrace;

      const rows = locked
        ? await sql`
          SELECT
            a.*,
            COALESCE(
              (SELECT COUNT(*) FROM application_events WHERE application_id = a.id),
              0
            )::int AS event_count,
            sj.url AS job_url,
            sj.source AS job_source
          FROM applications a
          LEFT JOIN saved_jobs sj ON a.job_id = sj.id
          WHERE a.id = ${id} AND a.user_id = ${user_id}
            AND a.id IN (
              SELECT id FROM applications
              WHERE user_id = ${user_id}
              ORDER BY created_at DESC
              LIMIT ${FREE_LIMIT}
            )
          LIMIT 1
        `
        : await sql`
          SELECT
            a.*,
            COALESCE(
              (SELECT COUNT(*) FROM application_events WHERE application_id = a.id),
              0
            )::int AS event_count,
            sj.url AS job_url,
            sj.source AS job_source
          FROM applications a
          LEFT JOIN saved_jobs sj ON a.job_id = sj.id
          WHERE a.id = ${id} AND a.user_id = ${user_id}
          LIMIT 1
        `;

      if (rows.length === 0) return null;

      const app = serializeApplication(rows[0] as Record<string, unknown>);

      // Fetch events
      const eventRows = await sql`
        SELECT * FROM application_events
        WHERE application_id = ${id}
        ORDER BY event_date DESC
      `;
      app.events = (eventRows as Record<string, unknown>[]).map(serializeEvent);

      return app;
    } catch (err) {
      console.error("getApplication error:", err);
      return null;
    }
  },
);

// ── createApplication ────────────────────────────────────────────────────────

export const createApplication = createServerFn({ method: "POST" }).handler(
  async ({
    data,
  }): Promise<{ success: boolean; application?: Application; error?: string }> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return { success: false, error: "Not logged in." };

    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return { success: false, error: "Not logged in." };
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return { success: false, error: "Not logged in." };

    const input = data as CreateApplicationInput;

    if (!input.job_title?.trim()) {
      return { success: false, error: "Job title is required." };
    }
    if (!input.company?.trim()) {
      return { success: false, error: "Company is required." };
    }

    // ── Check plan limits ──────────────────────────────────────────────────
    try {
      const planRows = await sql`
        SELECT plan FROM users WHERE id = ${user_id} LIMIT 1
      `;
      const plan = String(
        (planRows[0] as { plan: string } | undefined)?.plan ?? "free",
      );

      if (!["pro", "sprint", "momentum"].includes(plan)) {
        const countRows = await sql`
          SELECT COUNT(*)::int AS count FROM applications WHERE user_id = ${user_id}
        `;
        const currentCount =
          (countRows[0] as { count: number }).count ?? 0;

        if (currentCount >= 5) {
          return {
            success: false,
            error:
              "Free plan limited to 5 applications. Upgrade to Pro for unlimited tracking.",
          };
        }
      }
    } catch (limitErr) {
      console.error("Plan limit check error:", limitErr);
      // Proceed on error — don't block creating the application
    }

    const status = input.status || "applied";

    // Combine description into notes if provided and no explicit notes
    const effectiveNotes = input.notes?.trim() || input.description?.trim() || null;

    try {
      const rows = await sql`
        INSERT INTO applications
          (user_id, job_id, job_title, company, status, notes, follow_up_at, applied_at, job_url)
        VALUES (
          ${user_id},
          ${input.job_id ?? null},
          ${input.job_title.trim()},
          ${input.company.trim()},
          ${status},
          ${effectiveNotes ?? null},
          ${input.follow_up_at ? new Date(input.follow_up_at).toISOString() : null},
          ${status === "saved" ? null : new Date().toISOString()},
          ${input.job_url?.trim() ?? null}
        )
        RETURNING *
      `;

      const appRow = rows[0] as Record<string, unknown>;
      const app = serializeApplication(appRow, 0);

      // Create initial event only if not "saved"
      if (status !== "saved") {
        const eventRows = await sql`
          INSERT INTO application_events (application_id, event_type, notes)
          VALUES (${app.id}, ${status}, 'Application created')
          RETURNING *
        `;
        app.events = [(eventRows[0] as Record<string, unknown>)].map(
          serializeEvent,
        );
        app.event_count = 1;
      }

      return { success: true, application: app };
    } catch (err) {
      console.error("createApplication error:", err);
      return { success: false, error: "Failed to create application." };
    }
  },
);

// ── updateApplicationStatus ──────────────────────────────────────────────────

export const updateApplicationStatus = createServerFn({ method: "POST" }).handler(
  async ({
    data,
  }): Promise<{ success: boolean; application?: Application; error?: string }> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return { success: false, error: "Not logged in." };

    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return { success: false, error: "Not logged in." };
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return { success: false, error: "Not logged in." };

    const { id, status, notes } = (data ?? {}) as {
      id: string;
      status: ApplicationStatus;
      notes?: string;
    };

    if (!id || !status) {
      return { success: false, error: "Application ID and status are required." };
    }

    try {
      // Verify ownership
      const existing = await sql`
        SELECT * FROM applications WHERE id = ${id} AND user_id = ${user_id} LIMIT 1
      `;
      if (existing.length === 0) {
        return { success: false, error: "Application not found." };
      }

      const oldApp = existing[0] as Record<string, unknown>;
      const oldStatus = String(oldApp.status);

      // Update status and updated_at
      await sql`
        UPDATE applications
        SET status = ${status}, updated_at = now()
        WHERE id = ${id}
      `;

      // Add event for status change
      const eventLabel =
        status === "applied" && oldStatus === "saved"
          ? "Application submitted"
          : `Status changed from ${formatStatus(oldStatus)} to ${formatStatus(status)}`;
      await sql`
        INSERT INTO application_events (application_id, event_type, notes)
        VALUES (${id}, ${status}, ${notes?.trim() ?? eventLabel})
      `;

      // Return the updated application
      const updated = await sql`
        SELECT
          a.*,
          COALESCE(
            (SELECT COUNT(*) FROM application_events WHERE application_id = a.id),
            0
          )::int AS event_count,
          sj.url AS job_url,
          sj.source AS job_source
        FROM applications a
        LEFT JOIN saved_jobs sj ON a.job_id = sj.id
        WHERE a.id = ${id}
        LIMIT 1
      `;

      const app = serializeApplication(
        updated[0] as Record<string, unknown>,
      );

      const eventRows = await sql`
        SELECT * FROM application_events
        WHERE application_id = ${id}
        ORDER BY event_date DESC
      `;
      app.events = (eventRows as Record<string, unknown>[]).map(serializeEvent);

      return { success: true, application: app };
    } catch (err) {
      console.error("updateApplicationStatus error:", err);
      return { success: false, error: "Failed to update status." };
    }
  },
);

// ── updateApplication ────────────────────────────────────────────────────────

export const updateApplication = createServerFn({ method: "POST" }).handler(
  async ({
    data,
  }): Promise<{ success: boolean; application?: Application; error?: string }> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return { success: false, error: "Not logged in." };

    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return { success: false, error: "Not logged in." };
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return { success: false, error: "Not logged in." };

    const input = data as { id: string } & UpdateApplicationInput;

    if (!input.id) {
      return { success: false, error: "Application ID is required." };
    }

    try {
      // Verify ownership
      const existing = await sql`
        SELECT id FROM applications WHERE id = ${input.id} AND user_id = ${user_id} LIMIT 1
      `;
      if (existing.length === 0) {
        return { success: false, error: "Application not found." };
      }

      // Build update dynamically to avoid nesting sql tagged templates
      const setClauses: string[] = ["updated_at = now()"];
      const values: unknown[] = [];

      if (input.notes !== undefined) {
        values.push(input.notes?.trim() ?? null);
        setClauses.push(`notes = $${values.length}`);
      }
      if (input.follow_up_at !== undefined) {
        values.push(input.follow_up_at ? new Date(input.follow_up_at).toISOString() : null);
        setClauses.push(`follow_up_at = $${values.length}`);
      }

      values.push(input.id);
      const idParam = values.length;

      await sql(
        `UPDATE applications SET ${setClauses.join(", ")} WHERE id = $${idParam}`,
        ...values,
      );

      // Return updated
      const updated = await sql`
        SELECT
          a.*,
          COALESCE(
            (SELECT COUNT(*) FROM application_events WHERE application_id = a.id),
            0
          )::int AS event_count,
          sj.url AS job_url,
          sj.source AS job_source
        FROM applications a
        LEFT JOIN saved_jobs sj ON a.job_id = sj.id
        WHERE a.id = ${input.id}
        LIMIT 1
      `;

      const app = serializeApplication(
        updated[0] as Record<string, unknown>,
      );

      const eventRows = await sql`
        SELECT * FROM application_events
        WHERE application_id = ${input.id}
        ORDER BY event_date DESC
      `;
      app.events = (eventRows as Record<string, unknown>[]).map(serializeEvent);

      return { success: true, application: app };
    } catch (err) {
      console.error("updateApplication error:", err);
      return { success: false, error: "Failed to update application." };
    }
  },
);

// ── deleteApplication ────────────────────────────────────────────────────────

export const deleteApplication = createServerFn({ method: "POST" }).handler(
  async ({
    data,
  }): Promise<{ success: boolean; error?: string }> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return { success: false, error: "Not logged in." };

    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return { success: false, error: "Not logged in." };
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return { success: false, error: "Not logged in." };

    const { id } = (data ?? {}) as { id: string };

    if (!id) {
      return { success: false, error: "Application ID is required." };
    }

    try {
      const result = await sql`
        DELETE FROM applications
        WHERE id = ${id} AND user_id = ${user_id}
      `;
      if ((result as { rowCount: number }).rowCount === 0) {
        return { success: false, error: "Application not found." };
      }
      return { success: true };
    } catch (err) {
      console.error("deleteApplication error:", err);
      return { success: false, error: "Failed to delete application." };
    }
  },
);

// ── addApplicationEvent ──────────────────────────────────────────────────────

export const addApplicationEvent = createServerFn({ method: "POST" }).handler(
  async ({
    data,
  }): Promise<{ success: boolean; event?: ApplicationEvent; error?: string }> => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie("jobhub_session");
    if (!token) return { success: false, error: "Not logged in." };

    const sess = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sess.length === 0) return { success: false, error: "Not logged in." };
    const { user_id, expires_at } = sess[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) return { success: false, error: "Not logged in." };

    const { applicationId, eventType, notes } = (data ?? {}) as {
      applicationId: string;
      eventType: string;
      notes?: string;
    };

    if (!applicationId || !eventType) {
      return { success: false, error: "Application ID and event type are required." };
    }

    try {
      // Verify ownership
      const existing = await sql`
        SELECT id FROM applications WHERE id = ${applicationId} AND user_id = ${user_id} LIMIT 1
      `;
      if (existing.length === 0) {
        return { success: false, error: "Application not found." };
      }

      // Add event
      const rows = await sql`
        INSERT INTO application_events (application_id, event_type, notes)
        VALUES (${applicationId}, ${eventType}, ${notes?.trim() ?? null})
        RETURNING *
      `;

      // Touch application's updated_at
      await sql`
        UPDATE applications SET updated_at = now() WHERE id = ${applicationId}
      `;

      return {
        success: true,
        event: serializeEvent(rows[0] as Record<string, unknown>),
      };
    } catch (err) {
      console.error("addApplicationEvent error:", err);
      return { success: false, error: "Failed to add event." };
    }
  },
);

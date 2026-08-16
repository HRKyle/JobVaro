// Production server for the built site. The TanStack Start build emits a portable
// fetch handler (dist/server/server.js) plus static client assets (dist/client);
// this wraps them in a Bun server on port 3000 — static files first, SSR for the
// rest. Run `bun run build` before starting. Restart it with `bun run publish`.
//
// Starting a new instance supersedes the old one: it frees the port no matter
// which user owns the current server (provisioning starts it as `engine`; a team
// member's `bun run publish` runs as their own user), so publish never collides
// with an already-running server. Every sandbox user has passwordless sudo, so
// the takeover works across user boundaries.
import handler from "./dist/server/server.js";
import { neon } from "@neondatabase/serverless";
import { sql } from "./src/db";
import { runLapseSweep } from "./src/services/lapse-sweep";
import { handleStripeWebhook } from "./src/services/stripe-webhook";

// ── DB keep-alive ────────────────────────────────────────────────────────
// Neon's SQL-over-HTTP endpoint can go cold after a short idle (and right
// after a `bun run publish` restart); the first query then aborts with a
// transient TimeoutError. A lightweight `SELECT 1` every 45s (plus one at
// boot) keeps the endpoint warm so real user queries — signup, login, the
// community board — rarely hit a cold start. Failures are logged and
// swallowed; this is best-effort only. The timer lives in the server entry,
// so it only runs while the server process runs and never interferes with
// the build/publish phase.
const pingDb = () => {
  sql`SELECT 1`.catch((err: unknown) => {
    console.error("keep-alive ping failed:", err instanceof Error ? err.message : err);
  });
};
pingDb();
setInterval(pingDb, 45_000);

// ── Lapse sweep (data-lapse policy) ─────────────────────────────────────
// Runs once at boot and every 30 minutes: reverts lapsed plans, starts the
// 30-day grace period, sends pre-expiry / lapse-day / final-warning emails,
// and permanently deletes over-limit data once grace expires. runLapseSweep
// never throws (each step is isolated), so this can't crash the server or
// break `bun run publish`.
runLapseSweep().catch((err: unknown) => {
  console.error("lapse sweep boot run failed:", err instanceof Error ? err.message : err);
});
setInterval(() => {
  runLapseSweep().catch((err: unknown) => {
    console.error("lapse sweep interval run failed:", err instanceof Error ? err.message : err);
  });
}, 30 * 60 * 1000);

// Pinned, NOT read from the environment. The published preview URL
// (<label>.<PUBLIC_SITE_DOMAIN>) is reverse-proxied to 0.0.0.0:3000 inside the
// sandbox, so the default site MUST bind there. Bun auto-loads .env files, so
// honouring process.env.PORT/HOST would let a stray env var or a .env in the site
// dir silently move the site off :3000 (or onto loopback) and break the public URL.
const PORT = 3000;
const HOST = "0.0.0.0";
const CLIENT_DIR = `${import.meta.dir}/dist/client`;

// ── API helper: extension save-job ────────────────────────────────────────

let _sql: ReturnType<typeof neon> | null = null;
function getSql(): ReturnType<typeof neon> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _sql = neon(url);
  return _sql;
}

async function handleExtensionSaveJob(req: Request): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Auth via Authorization header
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return new Response(
      JSON.stringify({ success: false, error: "Not logged in." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const sql = getSql();

    // Validate session
    const sessions = await sql`
      SELECT user_id, expires_at FROM sessions WHERE token = ${token} LIMIT 1
    `;
    if (sessions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid session. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { user_id, expires_at } = sessions[0] as { user_id: string; expires_at: Date };
    if (new Date(expires_at) < new Date()) {
      await sql`DELETE FROM sessions WHERE token = ${token}`;
      return new Response(
        JSON.stringify({ success: false, error: "Session expired. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse body
    const body = (await req.json()) as {
      title?: string;
      company?: string;
      location?: string;
      description?: string;
      url?: string;
    };

    const jobTitle = body.title?.trim();
    const company = body.company?.trim();
    if (!jobTitle || !company) {
      return new Response(
        JSON.stringify({ success: false, error: "Job title and company are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check plan limits
    const planRows = await sql`
      SELECT plan FROM users WHERE id = ${user_id} LIMIT 1
    `;
    const plan = String((planRows[0] as { plan: string } | undefined)?.plan ?? "free");

    if (plan !== "pro") {
      const countRows = await sql`
        SELECT COUNT(*)::int AS count FROM applications WHERE user_id = ${user_id}
      `;
      const currentCount = (countRows[0] as { count: number }).count ?? 0;
      if (currentCount >= 20) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Free plan limited to 20 applications. Upgrade to Pro for unlimited tracking.",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Create application
    const effectiveNotes = body.description?.trim() || null;
    const jobUrl = body.url?.trim() || null;

    await sql`
      INSERT INTO applications
        (user_id, job_title, company, status, notes, applied_at, job_url)
      VALUES (
        ${user_id},
        ${jobTitle},
        ${company},
        'applied',
        ${effectiveNotes},
        ${new Date().toISOString()},
        ${jobUrl}
      )
    `;

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Extension save-job error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

// Free PORT regardless of which user owns the current listener. lsof runs under
// sudo so it can see (and the kill can signal) a process owned by another user;
// the loop waits for the socket to actually release before we bind.
const freePort =
  `for _ in $(seq 1 25); do ` +
  `pids=$(lsof -t -iTCP:${String(PORT)} -sTCP:LISTEN 2>/dev/null || true); ` +
  `if [ -z "$pids" ]; then exit 0; fi; ` +
  `kill $pids 2>/dev/null || true; sleep 0.2; ` +
  `done`;

// Take over the port, re-freeing and retrying if another publish grabbed it in the
// gap between freeing and binding (last publish wins). Bun.serve throws EADDRINUSE
// synchronously, so without this a raced publish would die while the shell already
// reported success.
for (let attempt = 1; ; attempt++) {
  await Bun.$`sudo sh -c ${freePort}`.quiet().nothrow();
  try {
    Bun.serve({
      port: PORT,
      hostname: HOST,
      async fetch(req) {
        const { pathname } = new URL(req.url);

        // ── API routes ──────────────────────────────────────────────────
        if (pathname === "/api/extension/save-job") {
          return handleExtensionSaveJob(req);
        }

        // ── Stripe webhook (public path: /api/stripe-webhook) ────────────
        // Signature check happens first on the RAW body; returns quickly and
        // never crashes on malformed input. See src/services/stripe.ts.
        if (pathname === "/api/stripe-webhook") {
          return handleStripeWebhook(req);
        }

        // ── Static files ────────────────────────────────────────────────
        if (pathname !== "/") {
          const file = Bun.file(CLIENT_DIR + pathname);
          if (await file.exists()) return new Response(file);
        }

        // ── SSR handler ─────────────────────────────────────────────────
        return (
          handler as { fetch: (r: Request) => Response | Promise<Response> }
        ).fetch(req);
      },
    });
    break;
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}

console.log(`team-site serving on http://${HOST}:${String(PORT)}`);

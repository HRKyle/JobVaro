/**
 * Session management using TanStack Start cookie helpers and the database.
 * Cookie-based sessions — no JWT, no external auth services.
 * All server imports use dynamic import() so the bundler doesn't trace them
 * into client bundles.
 */

import { sql } from "~/db";

const SESSION_COOKIE = "jobhub_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

function generateToken(): string {
  return crypto.randomUUID();
}

/**
 * Create a new session for a user.
 * Returns the session token.
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt.toISOString()})
  `;

  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return token;
}

/**
 * Get the current session from the cookie.
 * Returns `{ userId }` if valid, or `null` if there's no valid session.
 */
export async function getSession(): Promise<{ userId: string } | null> {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;

  const rows = await sql`
    SELECT user_id, expires_at
    FROM sessions
    WHERE token = ${token}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const { user_id, expires_at } = rows[0] as {
    user_id: string;
    expires_at: Date;
  };

  if (new Date(expires_at) < new Date()) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
    return null;
  }

  return { userId: user_id };
}

/**
 * Destroy the current session.
 */
export async function destroySession(): Promise<void> {
  const { getCookie, deleteCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

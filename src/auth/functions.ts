/**
 * Auth server functions — sign up, login, logout, and getCurrentUser.
 * All data access is done through server functions so DB queries are never
 * exposed to the client.
 */

import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { hashPassword, verifyPassword } from "./password";
// Session functions are imported dynamically inside handlers
// to prevent the bundler from tracing into auth/session.ts → @tanstack/react-start/server

// ── Shared types ────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  is_admin: boolean;
}

type AuthResult =
  | { success: true; user: AuthUser }
  | { success: false; error: string };

// ── Helpers ─────────────────────────────────────────────────────────────────

function validateEmail(email: string): string | null {
  if (!email || !email.includes("@")) {
    return "Please enter a valid email address.";
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

function validateName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return "Please enter your name.";
  }
  return null;
}

function toAuthUser(row: {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  is_admin?: boolean | null;
}): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    plan: String(row.plan ?? "free"),
    is_admin: Boolean(row.is_admin),
  };
}

// ── signUp ──────────────────────────────────────────────────────────────────

export const signUp = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<AuthResult> => {
    const { email, password, name } = data as {
      email: string;
      password: string;
      name: string;
    };

    const emailErr = validateEmail(email);
    if (emailErr) return { success: false, error: emailErr };

    const passwordErr = validatePassword(password);
    if (passwordErr) return { success: false, error: passwordErr };

    const nameErr = validateName(name);
    if (nameErr) return { success: false, error: nameErr };

    try {
      // Check uniqueness
      const existing = await sql`
        SELECT id FROM users WHERE email = ${email} LIMIT 1
      `;
      if (existing.length > 0) {
        return { success: false, error: "An account with this email already exists." };
      }

      const passwordHash = await hashPassword(password);

      const rows = await sql`
        INSERT INTO users (email, password_hash, name, plan)
        VALUES (${email}, ${passwordHash}, ${name.trim()}, 'free')
        RETURNING id, email, name, plan, is_admin
      `;

      const user = rows[0] as {
        id: string;
        email: string;
        name: string | null;
        plan: string;
        is_admin: boolean;
      };

      // Create a session so the user is immediately logged in
      const { createSession } = await import("./session");
      await createSession(String(user.id));

      return { success: true, user: toAuthUser(user) };
    } catch (err) {
      console.error("signUp error:", err);
      return { success: false, error: "Something went wrong. Please try again." };
    }
  },
);

// ── login ───────────────────────────────────────────────────────────────────

export const login = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<AuthResult> => {
    const { email, password } = data as { email: string; password: string };

    const emailErr = validateEmail(email);
    if (emailErr) return { success: false, error: emailErr };

    const passwordErr = validatePassword(password);
    if (passwordErr) return { success: false, error: passwordErr };

    try {
      const rows = await sql`
        SELECT id, email, name, plan, password_hash, is_admin
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return { success: false, error: "Invalid email or password." };
      }

      const row = rows[0] as {
        id: string;
        email: string;
        name: string | null;
        plan: string;
        password_hash: string;
        is_admin: boolean;
      };

      const valid = await verifyPassword(password, String(row.password_hash));
      if (!valid) {
        return { success: false, error: "Invalid email or password." };
      }

      const { createSession } = await import("./session");
      await createSession(String(row.id));

      return { success: true, user: toAuthUser(row) };
    } catch (err) {
      console.error("login error:", err);
      return { success: false, error: "Something went wrong. Please try again." };
    }
  },
);

// ── logout ──────────────────────────────────────────────────────────────────

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { destroySession } = await import("./session");
    await destroySession();
    return { success: true };
  } catch (err) {
    console.error("logout error:", err);
    return { success: false, error: "Something went wrong." };
  }
});

// ── getSessionToken ──────────────────────────────────────────────────────────
// Returns the current session token so users can copy it for the browser extension.

export const getSessionToken = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ token: string | null }> => {
    try {
      const { getCookie } = await import("@tanstack/react-start/server");
      const token = getCookie("jobhub_session");
      return { token: token || null };
    } catch {
      return { token: null };
    }
  },
);

// ── getCurrentUser ──────────────────────────────────────────────────────────

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ user: AuthUser | null }> => {
    try {
      const { getSession } = await import("./session");
      const session = await getSession();
      if (!session) return { user: null };

      const rows = await sql`
        SELECT id, email, name, plan, is_admin
        FROM users
        WHERE id = ${session.userId}
        LIMIT 1
      `;

      if (rows.length === 0) return { user: null };

      return { user: toAuthUser(rows[0] as { id: string; email: string; name: string | null; plan: string; is_admin: boolean }) };
    } catch (err) {
      console.error("getCurrentUser error:", err);
      return { user: null };
    }
  },
);

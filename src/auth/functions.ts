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

// ── Password reset helpers ───────────────────────────────────────────────────
// Token generation/verification uses the Web Crypto API (globalThis.crypto),
// available in both Bun server code and modern browsers — deliberately NOT
// node:crypto so these modules never break the client bundle.

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
const RESET_COOLDOWN_MS = 60 * 1000; // at most one reset email per account / min

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 32 random bytes as a 64-char hex string (~256 bits of entropy).
function randomToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function resetEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.02em;">JobVaro</span>
                <span style="color:#c7d2fe;font-size:12px;font-weight:600;margin-left:8px;">by HRKyle</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#27272a;font-size:15px;line-height:1.6;">
                <p>Hi there,</p>
                <p>We received a request to reset the password for your JobVaro account. Click the button below to choose a new password. This link expires in <strong>60 minutes</strong> and can only be used once.</p>
                <p style="margin:28px 0 0 0;text-align:center;">
                  <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;">Reset your password</a>
                </p>
                <p style="margin:28px 0 0 0;font-size:13px;color:#71717a;">If the button doesn't work, copy and paste this link into your browser:<br /><a href="${resetUrl}" style="color:#4f46e5;word-break:break-all;">${resetUrl}</a></p>
                <p style="margin:20px 0 0 0;font-size:13px;color:#71717a;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #f0f0f2;color:#71717a;font-size:12px;line-height:1.5;">
                You're receiving this because someone asked to reset your JobVaro password. · <a href="https://www.jobvaro.com" style="color:#4f46e5;">JobVaro</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ── requestPasswordReset ─────────────────────────────────────────────────────
// Always returns a generic success message whether or not the email has an
// account — this prevents account enumeration. If no account exists, it simply
// does nothing (and logs nothing sensitive).

export const requestPasswordReset = createServerFn({ method: "POST" }).handler(
  async ({
    data,
  }): Promise<{ success: true } | { success: false; error: string }> => {
    const { email } = (data ?? {}) as { email?: string };
    const normalized = (email ?? "").trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      // Invalid input, but still respond generically to avoid probing.
      return { success: true };
    }

    try {
      const rows = await sql`
        SELECT id, email FROM users WHERE email = ${normalized} LIMIT 1
      `;
      if (rows.length > 0) {
        const user = rows[0] as { id: string; email: string };

        // Light rate-limit: at most one reset email per account per minute.
        const recent = await sql`
          SELECT id FROM password_reset_tokens
          WHERE user_id = ${String(user.id)} AND used_at IS NULL
            AND created_at > now() - interval '60 seconds'
          LIMIT 1
        `;
        if (recent.length === 0) {
          const raw = randomToken();
          const hash = await sha256Hex(raw);
          const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
          await sql`
            INSERT INTO password_reset_tokens (user_id, token_hash, email, expires_at)
            VALUES (${String(user.id)}, ${hash}, ${normalized}, ${expiresAt.toISOString()})
          `;
          const resetUrl = `https://www.jobvaro.com/reset-password?token=${encodeURIComponent(raw)}&email=${encodeURIComponent(normalized)}`;
          const { sendEmail } = await import("~/services/email");
          await sendEmail({
            to: normalized,
            subject: "Reset your JobVaro password",
            html: resetEmailHtml(resetUrl),
          });
        }
      }
      // Same generic response for both existing and non-existing accounts.
      return { success: true };
    } catch (err) {
      console.error("requestPasswordReset error:", err);
      // Never reveal account existence — fail closed with a generic message.
      return { success: true };
    }
  },
);

// ── resetPassword ────────────────────────────────────────────────────────────
// Verifies the single-use token (exists, unused, unexpired, matches the email
// in the link), updates the password, marks the token used, and destroys all of
// the user's existing sessions so previously-issued sessions are invalidated.

export const resetPassword = createServerFn({ method: "POST" }).handler(
  async ({
    data,
  }): Promise<{ success: true } | { success: false; error: string }> => {
    const { token, email, password } = (data ?? {}) as {
      token?: string;
      email?: string;
      password?: string;
    };
    const normalized = (email ?? "").trim().toLowerCase();

    if (!token || typeof token !== "string" || token.length < 20) {
      return {
        success: false,
        error: "This reset link is invalid or has expired. Please request a new one.",
      };
    }
    const passwordErr = validatePassword(password ?? "");
    if (passwordErr) return { success: false, error: passwordErr };

    try {
      const hash = await sha256Hex(token);
      const rows = await sql`
        SELECT prt.user_id, u.email AS user_email
        FROM password_reset_tokens prt
        JOIN users u ON u.id = prt.user_id
        WHERE prt.token_hash = ${hash}
          AND prt.used_at IS NULL
          AND prt.expires_at > now()
        LIMIT 1
      `;
      if (rows.length === 0) {
        return {
          success: false,
          error: "This reset link is invalid or has expired. Please request a new one.",
        };
      }
      const row = rows[0] as { user_id: string; user_email: string };

      // Ensure the email in the link matches the account the token was issued for.
      if (String(row.user_email).toLowerCase() !== normalized) {
        return {
          success: false,
          error: "This reset link is invalid or has expired. Please request a new one.",
        };
      }

      const userId = String(row.user_id);
      const newHash = await hashPassword(password!);

      // Update the password, mark the token consumed (single-use), and destroy
      // all existing sessions so the old password can't be used anywhere else.
      await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}`;
      await sql`UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = ${hash}`;
      await sql`DELETE FROM sessions WHERE user_id = ${userId}`;

      return { success: true };
    } catch (err) {
      console.error("resetPassword error:", err);
      return { success: false, error: "Something went wrong. Please try again." };
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

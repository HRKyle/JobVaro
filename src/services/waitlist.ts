/**
 * Waitlist / early-access email capture.
 *
 * A lightweight, opt-in signup that records an email (and optionally a name +
 * provenance) so the team can reach out about early access and product updates.
 * No account is created — this is purely an email list.
 *
 * Handled here: email format validation, case-insensitive dedupe, and source/IP
 * capture. Deliberately does NOT leak whether an address already exists: if the
 * email is already on the list we still report success so the visitor sees the
 * friendly "you're on the list" state either way.
 */
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

export interface JoinWaitlistInput {
  email: string;
  name?: string;
  source?: string;
}

export type JoinWaitlistResult =
  | { success: true }
  | { success: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Best-effort capture of the visitor's IP (optional). Never throws. */
async function captureIp(): Promise<string | null> {
  try {
    const { getRequestIP } = await import("@tanstack/react-start/server");
    const ip = getRequestIP();
    return ip && ip.trim().length > 0 ? ip.trim() : null;
  } catch {
    return null;
  }
}

export const joinWaitlist = createServerFn({ method: "POST" }).handler(
  async ({ data }): Promise<JoinWaitlistResult> => {
    const { email, name, source } = data as JoinWaitlistInput;
    const cleanEmail = (email ?? "").trim().toLowerCase();
    const cleanName = (name ?? "").trim().slice(0, 255) || null;
    const cleanSource = (source ?? "").trim().slice(0, 100) || null;

    // Validate email format.
    if (!EMAIL_RE.test(cleanEmail)) {
      return { success: false, error: "Please enter a valid email address." };
    }

    try {
      const ip = await captureIp();
      // citext dedupes case-insensitively; DO NOTHING keeps existing rows so a
      // repeat signup still returns success without leaking the prior existence.
      await sql`
        INSERT INTO waitlist (email, name, source, ip)
        VALUES (${cleanEmail}, ${cleanName}, ${cleanSource}, ${ip})
        ON CONFLICT (email) DO NOTHING
      `;
      return { success: true };
    } catch (err) {
      console.error("joinWaitlist error:", err);
      return {
        success: false,
        error: "Something went wrong. Please try again.",
      };
    }
  },
);

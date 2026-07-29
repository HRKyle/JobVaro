/**
 * URL metadata extractor — fetches a job listing URL server-side and extracts
 * title, company, description, and location from Open Graph tags, <title>,
 * JSON-LD structured data, and schema.org markup.
 *
 * Never imported by client code — wrapped in a server function.
 */

import { createServerFn } from "@tanstack/react-start";

export interface ExtractedJobData {
  title: string;
  company: string;
  description: string;
  location: string;
  url: string;
}

export const extractJobFromUrl = createServerFn({ method: "POST" }).handler(
  async ({
    data,
  }): Promise<{ success: boolean; data?: ExtractedJobData; error?: string }> => {
    const { url } = (data ?? {}) as { url: string };

    // ── Validate URL ──────────────────────────────────────────────────────
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { success: false, error: "Please enter a valid URL." };
    }

    if (!parsedUrl.protocol.startsWith("http")) {
      return { success: false, error: "Only HTTP/HTTPS URLs are supported." };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "JobVaro/1.0 (job-search-tracker)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          success: false,
          error: `Could not fetch URL (status ${response.status}).`,
        };
      }

      const html = await response.text();
      const result: ExtractedJobData = {
        title: "",
        company: "",
        description: "",
        location: "",
        url,
      };

      // ── 1. Open Graph meta tags ─────────────────────────────────────────
      const ogTitle = extractMeta(html, "og:title");
      const ogDescription = extractMeta(html, "og:description");
      const ogSiteName = extractMeta(html, "og:site_name");

      if (ogTitle) result.title = ogTitle;
      if (ogDescription) result.description = ogDescription;
      if (ogSiteName) result.company = ogSiteName;

      // ── 2. <title> tag ──────────────────────────────────────────────────
      if (!result.title) {
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (titleMatch) {
          let rawTitle = titleMatch[1]
            .trim()
            // Decode common HTML entities
            .replace(/&amp;/g, "&")
            .replace(/&#x2F;/g, "/")
            .replace(/&#39;/g, "'");

          // Strip common suffixes: "| Company", "- Company", "— Company"
          rawTitle = rawTitle
            .replace(/\s*\|\s*.*$/, "")
            .replace(/\s*[-–—]\s*.*?(careers|jobs|apply|hiring).*$/i, "")
            .trim();

          if (rawTitle.length > 0 && rawTitle.length < 150) {
            result.title = rawTitle;
          }
        }
      }

      // ── 3. JSON-LD structured data ──────────────────────────────────────
      const jsonLdBlocks = html.match(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
      );
      if (jsonLdBlocks) {
        for (const block of jsonLdBlocks) {
          try {
            const jsonStr = block
              .replace(
                /<script[^>]*type="application\/ld\+json"[^>]*>/i,
                "",
              )
              .replace(/<\/script>/i, "");
            const parsed = JSON.parse(jsonStr);

            // Handle @graph arrays or single objects
            const item: Record<string, unknown> | undefined =
              Array.isArray(parsed["@graph"])
                ? (parsed["@graph"] as Record<string, unknown>[]).find(
                    (g) => g["@type"] === "JobPosting",
                  )
                : parsed;

            if (item && item["@type"] === "JobPosting") {
              if (!result.title && item.title)
                result.title = String(item.title);
              if (!result.company && item.hiringOrganization) {
                const org = item.hiringOrganization as Record<string, unknown>;
                result.company = org.name
                  ? String(org.name)
                  : String(item.hiringOrganization);
              }
              if (!result.description && item.description) {
                result.description =
                  typeof item.description === "string"
                    ? item.description
                    : "";
              }
              if (!result.location && item.jobLocation) {
                const loc = item.jobLocation as Record<string, unknown>;
                const addr = loc.address as Record<string, unknown> | undefined;
                if (addr?.addressLocality) {
                  result.location = String(addr.addressLocality);
                } else if (loc.name) {
                  result.location = String(loc.name);
                }
              }
            }
          } catch {
            // Skip unparseable JSON-LD blocks
          }
        }
      }

      // ── 4. "at Company" pattern in title ────────────────────────────────
      if (!result.company && result.title) {
        const atMatch = result.title.match(/\s+at\s+(.+)$/i);
        if (atMatch) {
          result.company = atMatch[1].trim();
          result.title = result.title
            .replace(/\s+at\s+.+$/i, "")
            .trim();
        }
      }

      // ── 5. schema.org inline JSON fallback ─────────────────────────────
      if (!result.title) {
        const m = html.match(/"title"\s*:\s*"([^"]+)"/);
        if (m) result.title = m[1];
      }
      if (!result.company) {
        const m = html.match(
          /"hiringOrganization"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/,
        );
        if (m) result.company = m[1];
      }

      // ── 6. Post-processing ──────────────────────────────────────────────
      // Strip HTML tags from description
      if (result.description) {
        result.description = result.description
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 1000);
      }

      // Decode HTML entities in title
      result.title = result.title
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .trim();

      result.company = result.company
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();

      // ── 7. Final sanity check ───────────────────────────────────────────
      if (!result.title && !result.company) {
        return {
          success: false,
          error: "Couldn't extract details — add manually.",
        };
      }

      return { success: true, data: result };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return {
          success: false,
          error: "Request timed out. Try adding manually.",
        };
      }
      return {
        success: false,
        error: "Couldn't extract details — add manually.",
      };
    }
  },
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractMeta(html: string, property: string): string {
  const escaped = escapeRegex(property);

  // Standard: <meta property="og:title" content="...">
  const regex = new RegExp(
    `<meta[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const match = html.match(regex);
  if (match) return match[1].trim();

  // Reversed order: <meta content="..." property="og:title">
  const revRegex = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
    "i",
  );
  const revMatch = html.match(revRegex);
  if (revMatch) return revMatch[1].trim();

  return "";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

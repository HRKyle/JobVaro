/**
 * Server-only geocoding helpers for radius-based job search.
 *
 * Two-tier, dependency-light, US-focused geocoding (no API key, no paid service):
 *   1. Primary  — Open-Meteo's FREE geocoding API (no key, generous tier):
 *        https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1&language=en&format=json
 *   2. Fallback — a small bundled US metro reference (works offline / if the
 *        API is unreachable).
 *
 * Everything here is best-effort and MUST NEVER block or crash the caller.
 * Resolving a location that fails/ is ambiguous returns null (the job simply
 * won't participate in radius filtering).
 *
 * IMPORTANT: do NOT import this module from client code. It touches the DB and
 * performs server-side HTTP fetches.
 */

import { sql } from "~/db";

export interface Coords {
  lat: number;
  lng: number;
}

// ── Bundled US metro reference (fallback, offline) ─────────────────────────
// Normalized city name (lowercased) -> [lat, lng]
const US_CITIES: Record<string, [number, number]> = {
  "austin": [30.2672, -97.7431],
  "houston": [29.7604, -95.3698],
  "dallas": [32.7767, -96.797],
  "fort worth": [32.7555, -97.3308],
  "san antonio": [29.4241, -98.4936],
  "new york": [40.7128, -74.006],
  "brooklyn": [40.6782, -73.9442],
  "buffalo": [42.8864, -78.8784],
  "san francisco": [37.7749, -122.4194],
  "san jose": [37.3382, -121.8863],
  "oakland": [37.8044, -122.2712],
  "los angeles": [34.0522, -118.2437],
  "san diego": [32.7157, -117.1611],
  "sacramento": [38.5816, -121.4944],
  "chicago": [41.8781, -87.6298],
  "boston": [42.3601, -71.0589],
  "cambridge": [42.3736, -71.1097],
  "seattle": [47.6062, -122.3321],
  "denver": [39.7392, -104.9903],
  "boulder": [40.015, -105.2705],
  "washington": [38.9072, -77.0369],
  "baltimore": [39.2904, -76.6122],
  "philadelphia": [39.9526, -75.1652],
  "atlanta": [33.749, -84.388],
  "miami": [25.7617, -80.1918],
  "orlando": [28.5383, -81.3792],
  "tampa": [27.9506, -82.4572],
  "minneapolis": [44.9778, -93.265],
  "detroit": [42.3314, -83.0458],
  "ann arbor": [42.2808, -83.743],
  "phoenix": [33.4484, -112.074],
  "scottsdale": [33.4942, -111.9261],
  "las vegas": [36.1699, -115.1398],
  "portland": [45.5152, -122.6784],
  "salt lake city": [40.7608, -111.891],
  "provo": [40.2338, -111.6585],
  "charlotte": [35.2271, -80.8431],
  "raleigh": [35.7796, -78.6382],
  "durham": [35.994, -78.8986],
  "nashville": [36.1627, -86.7816],
  "memphis": [35.1495, -90.049],
  "new orleans": [29.9511, -90.0715],
  "kansas city": [39.0997, -94.5786],
  "st. louis": [38.627, -90.1994],
  "columbus": [39.9612, -82.9988],
  "cincinnati": [39.1031, -84.512],
  "cleveland": [41.4993, -81.6944],
  "pittsburgh": [40.4406, -79.9959],
  "indianapolis": [39.7684, -86.1581],
  "milwaukee": [43.0389, -87.9065],
  "omaha": [41.2565, -95.9345],
  "oklahoma city": [35.4676, -97.5164],
  "tulsa": [36.154, -95.9928],
  "albuquerque": [35.0844, -106.6504],
  "tucson": [32.2226, -110.9747],
  "ventura": [34.2805, -119.2945],
  "charleston": [32.7765, -79.9311],
  "richmond": [37.5407, -77.436],
  "louisville": [38.2527, -85.7585],
  "hartford": [41.7658, -72.6734],
  "providence": [41.824, -71.4128],
  "anchorage": [61.2181, -149.9003],
  "honolulu": [21.3069, -157.8583],
  "boise": [43.615, -116.2023],
  "reno": [39.5296, -119.8138],
  "spokane": [47.6588, -117.426],
  "des moines": [41.5868, -93.625],
  "madison": [43.0731, -89.4012],
};

// ── In-memory cache: normalized query -> coords | null ────────────────────
const cache = new Map<string, Coords | null>();

/** True when a location string is (primarily) a remote role. */
export function isRemoteLocation(location: string | null | undefined): boolean {
  return !!location && /remote/i.test(location);
}

/**
 * Try to extract a plausible "City, ST" (US) or "City ST" pair from a
 * free-form location string. Returns the normalized city name or null if no
 * likely US city/state is present (e.g. "Remote", "US", "Global", "Europe").
 */
export function extractUsCity(location: string | null | undefined): string | null {
  if (!location) return null;
  const text = location.trim();
  if (!text || /remote|anywhere|hybrid|global|worldwide|united states|online/i.test(text)) {
    // Remote/global/ambiguous → not a single US metro we can geocode.
    if (/remote|anywhere|global|worldwide|online/i.test(text)) return null;
  }
  // "City, ST" — the dominant US ATS format.
  const withState = text.match(/^([A-Za-z .'-]{2,50}),\s*([A-Z]{2})(?:\s|$)/);
  if (withState) {
    const city = withState[1].trim();
    if (city.length >= 2) return city.toLowerCase();
    return null;
  }
  // "City ST" (no comma), e.g. "Austin TX".
  const noComma = text.match(/^([A-Za-z .'-]{2,50})\s+([A-Z]{2})$/);
  if (noComma) return noComma[1].trim().toLowerCase();
  // Just a city name with no state — still geocodable in many cases.
  if (/^[A-Za-z .'-]{2,50}$/.test(text) && !/\d/.test(text)) {
    return text.toLowerCase();
  }
  return null;
}

/**
 * Geocode a raw city name (e.g. "Austin", "New York") to lat/lng.
 * Tries Open-Meteo first, then the bundled fallback. Never throws.
 */
export async function geocodeCity(name: string): Promise<Coords | null> {
  const key = (name || "").trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  // 1) Open-Meteo free geocoding API.
  try {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search?name=" +
      encodeURIComponent(name.trim()) +
      "&count=1&language=en&format=json";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (resp.ok) {
        const data = (await resp.json()) as {
          results?: Array<{
            latitude?: number;
            longitude?: number;
            country_code?: string;
          }>;
        };
        const r = data.results?.[0];
        // Prefer US matches (country_code "US").
        const us = (data.results ?? []).find((x) => x.country_code === "US");
        const chosen = us ?? r;
        if (chosen && typeof chosen.latitude === "number" && typeof chosen.longitude === "number") {
          const coords = { lat: chosen.latitude, lng: chosen.longitude };
          cache.set(key, coords);
          return coords;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // fall through to bundled reference
  }

  // 2) Bundled US metro reference.
  const fallback = US_CITIES[key];
  if (fallback) {
    const coords = { lat: fallback[0], lng: fallback[1] };
    cache.set(key, coords);
    return coords;
  }

  cache.set(key, null);
  return null;
}

/**
 * Resolve a free-form job location string ("Austin, TX", "Remote", ...) to
 * coordinates when it looks like a single US metro. Returns null for remote,
 * ambiguous, or unresolvable locations (→ no radius filtering for that job).
 * Never throws.
 */
export async function geocodeJobLocation(location: string | null | undefined): Promise<Coords | null> {
  if (isRemoteLocation(location)) return null;
  const city = extractUsCity(location);
  if (!city) return null;
  return geocodeCity(city);
}

// ── Distance helper ─────────────────────────────────────────────────────────

/** Great-circle (haversine) distance in miles between two coordinates. */
export function haversineMiles(a: Coords, b: Coords): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ── Backfill: geocode existing jobs missing coordinates ────────────────────
// Best-effort; updates rows whose location is a resolvable US metro and whose
// coordinates are currently NULL. Returns { updated, tables }.
export async function backfillJobGeocoding(): Promise<{ updated: number; tables: number }> {
  const targets: Array<{ table: string; idCol: string }> = [
    { table: "jobs_feed", idCol: "id" },
    { table: "saved_jobs", idCol: "id" },
    { table: "community_jobs", idCol: "id" },
  ];
  let updated = 0;
  let tables = 0;
  // Process a limited batch per table so refresh stays cheap.
  for (const { table } of targets) {
    try {
      const rows = await sql(
        `SELECT ${table === "saved_jobs" ? "id" : "id"} AS id, location FROM ${table}
         WHERE (lat IS NULL OR lng IS NULL) AND location IS NOT NULL
         LIMIT 200`,
      );
      for (const row of rows as Array<{ id: string; location: string | null }>) {
        const coords = await geocodeJobLocation(row.location);
        if (coords) {
          try {
            await sql(`UPDATE ${table} SET lat = $1, lng = $2 WHERE id = $3`, coords.lat, coords.lng, row.id);
            updated++;
          } catch {
            // ignore per-row failures
          }
        }
      }
      tables++;
    } catch {
      // table may not have geo columns yet (pre-migration) — ignore
    }
  }
  return { updated, tables };
}

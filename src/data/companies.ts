/**
 * Curated list of companies available for the JobVaro company watchlist.
 *
 * OPTION B (owner-ratified): the watchlist may ONLY contain feed-backed
 * companies that auto-pull live job openings from a public ATS feed. Every
 * entry here must declare a real ATS platform (greenhouse / lever /
 * smartrecruiters / ashby). Companies that do not publish a public job feed
 * are intentionally NOT listed — they cannot be auto-tracked.
 */

export interface CompanyEntry {
  name: string;
  slug: string;
  ats: "greenhouse" | "lever" | "smartrecruiters" | "ashby" | "none";
}

export const COMPANIES: CompanyEntry[] = [
  // ── Greenhouse ──
  { name: "Airbnb", slug: "airbnb", ats: "greenhouse" },
  { name: "Asana", slug: "asana", ats: "greenhouse" },
  { name: "Atlassian", slug: "atlassian", ats: "greenhouse" },
  { name: "Canva", slug: "canva", ats: "greenhouse" },
  { name: "Cloudflare", slug: "cloudflare", ats: "greenhouse" },
  { name: "Coinbase", slug: "coinbase", ats: "greenhouse" },
  { name: "Datadog", slug: "datadog", ats: "greenhouse" },
  { name: "Dropbox", slug: "dropbox", ats: "greenhouse" },
  { name: "Duolingo", slug: "duolingo", ats: "greenhouse" },
  { name: "Figma", slug: "figma", ats: "greenhouse" },
  { name: "GitHub", slug: "github", ats: "greenhouse" },
  { name: "GitLab", slug: "gitlab", ats: "greenhouse" },
  { name: "Gusto", slug: "gusto", ats: "greenhouse" },
  { name: "HubSpot", slug: "hubspot", ats: "greenhouse" },
  { name: "Instacart", slug: "instacart", ats: "greenhouse" },
  { name: "Lyft", slug: "lyft", ats: "greenhouse" },
  { name: "Netflix", slug: "netflix", ats: "greenhouse" },
  { name: "Notion", slug: "notion", ats: "greenhouse" },
  { name: "Pinterest", slug: "pinterest", ats: "greenhouse" },
  { name: "Reddit", slug: "reddit", ats: "greenhouse" },
  { name: "Robinhood", slug: "robinhood", ats: "greenhouse" },
  { name: "Shopify", slug: "shopify", ats: "greenhouse" },
  { name: "Slack", slug: "slack", ats: "greenhouse" },
  { name: "Snap", slug: "snap", ats: "greenhouse" },
  { name: "Snowflake", slug: "snowflake", ats: "greenhouse" },
  { name: "Spotify", slug: "spotify", ats: "greenhouse" },
  { name: "Square", slug: "square", ats: "greenhouse" },
  { name: "Stripe", slug: "stripe", ats: "greenhouse" },
  { name: "Twilio", slug: "twilio", ats: "greenhouse" },
  { name: "Uber", slug: "uber", ats: "greenhouse" },
  { name: "Vercel", slug: "vercel", ats: "greenhouse" },
  { name: "Wikimedia", slug: "wikimedia", ats: "greenhouse" },
  { name: "Yelp", slug: "yelp", ats: "greenhouse" },
  { name: "Zapier", slug: "zapier", ats: "greenhouse" },
  { name: "Zoom", slug: "zoom", ats: "greenhouse" },
  { name: "Affirm", slug: "affirm", ats: "greenhouse" },
  { name: "Algolia", slug: "algolia", ats: "greenhouse" },
  { name: "Anyscale", slug: "anyscale", ats: "greenhouse" },
  { name: "Apollo GraphQL", slug: "apollo", ats: "greenhouse" },
  { name: "AppLovin", slug: "applovin", ats: "greenhouse" },
  { name: "Benchling", slug: "benchling", ats: "greenhouse" },
  { name: "Braze", slug: "braze", ats: "greenhouse" },
  { name: "Carta", slug: "carta", ats: "greenhouse" },
  { name: "Chime", slug: "chime", ats: "greenhouse" },
  { name: "ClickUp", slug: "clickup", ats: "greenhouse" },
  { name: "Confluent", slug: "confluent", ats: "greenhouse" },
  { name: "Coursera", slug: "coursera", ats: "greenhouse" },
  { name: "Dbt Labs", slug: "dbt-labs", ats: "greenhouse" },
  { name: "Deel", slug: "deel", ats: "greenhouse" },
  { name: "Discord", slug: "discord", ats: "greenhouse" },
  { name: "Docker", slug: "docker", ats: "greenhouse" },
  { name: "Elastic", slug: "elastic", ats: "greenhouse" },
  { name: "Epic Games", slug: "epic-games", ats: "greenhouse" },
  { name: "Faire", slug: "faire", ats: "greenhouse" },
  { name: "Fastly", slug: "fastly", ats: "greenhouse" },
  { name: "Flexport", slug: "flexport", ats: "greenhouse" },
  { name: "Grammarly", slug: "grammarly", ats: "greenhouse" },
  { name: "HashiCorp", slug: "hashicorp", ats: "greenhouse" },
  { name: "Hims & Hers", slug: "hims-hers", ats: "greenhouse" },
  { name: "Intercom", slug: "intercom", ats: "greenhouse" },
  { name: "Khan Academy", slug: "khan-academy", ats: "greenhouse" },
  { name: "Lattice", slug: "lattice", ats: "greenhouse" },
  { name: "Miro", slug: "miro", ats: "greenhouse" },
  { name: "MongoDB", slug: "mongodb", ats: "greenhouse" },
  { name: "Mozilla", slug: "mozilla", ats: "greenhouse" },
  { name: "Niantic", slug: "niantic", ats: "greenhouse" },
  { name: "Okta", slug: "okta", ats: "greenhouse" },
  { name: "Peloton", slug: "peloton", ats: "greenhouse" },
  { name: "Postman", slug: "postman", ats: "greenhouse" },
  { name: "Retool", slug: "retool", ats: "greenhouse" },
  { name: "Roblox", slug: "roblox", ats: "greenhouse" },
  { name: "Roku", slug: "roku", ats: "greenhouse" },
  { name: "Sentry", slug: "sentry", ats: "greenhouse" },
  { name: "Splunk", slug: "splunk", ats: "greenhouse" },
  { name: "Substack", slug: "substack", ats: "greenhouse" },
  { name: "Tailscale", slug: "tailscale", ats: "greenhouse" },
  { name: "Twitch", slug: "twitch", ats: "greenhouse" },
  { name: "Unity", slug: "unity", ats: "greenhouse" },
  { name: "Vanta", slug: "vanta", ats: "greenhouse" },
  { name: "Warp", slug: "warp", ats: "greenhouse" },
  { name: "Webflow", slug: "webflow", ats: "greenhouse" },
  { name: "Zendesk", slug: "zendesk", ats: "greenhouse" },
  { name: "Zscaler", slug: "zscaler", ats: "greenhouse" },
  { name: "Rivian", slug: "rivian", ats: "greenhouse" },
  { name: "Bolt", slug: "bolt", ats: "greenhouse" },
  { name: "Databricks", slug: "databricks", ats: "greenhouse" },
  { name: "Etsy", slug: "etsy", ats: "greenhouse" },

  // ── Lever ──
  { name: "Airtable", slug: "airtable", ats: "lever" },
  { name: "Brex", slug: "brex", ats: "lever" },
  { name: "Checkr", slug: "checkr", ats: "lever" },
  { name: "Fly.io", slug: "fly.io", ats: "lever" },
  { name: "Linear", slug: "linear", ats: "lever" },
  { name: "Mercury", slug: "mercury", ats: "lever" },
  { name: "Netlify", slug: "netlify", ats: "lever" },
  { name: "OpenAI", slug: "openai", ats: "lever" },
  { name: "Palantir", slug: "palantir", ats: "lever" },
  { name: "Ramp", slug: "ramp", ats: "lever" },
  { name: "Scale AI", slug: "scaleai", ats: "lever" },
  { name: "Sourcegraph", slug: "sourcegraph", ats: "lever" },
  { name: "Supabase", slug: "supabase", ats: "lever" },
  { name: "Temporal", slug: "temporal", ats: "lever" },
  { name: "Weights & Biases", slug: "wandb", ats: "lever" },
  { name: "Anduril", slug: "anduril", ats: "lever" },
  { name: "Astranis", slug: "astranis", ats: "lever" },
  { name: "Cruise", slug: "cruise", ats: "lever" },
  { name: "Hugging Face", slug: "huggingface", ats: "lever" },
  { name: "Klarna", slug: "klarna", ats: "lever" },
  { name: "Plaid", slug: "plaid", ats: "lever" },
  { name: "Rippling", slug: "rippling", ats: "lever" },
  { name: "Waymo", slug: "waymo", ats: "lever" },
  { name: "AbCellera", slug: "abcellera", ats: "lever" },
  { name: "Applied Intuition", slug: "applied-intuition", ats: "lever" },
  { name: "Clearbit", slug: "clearbit", ats: "lever" },
  { name: "Cohere", slug: "cohere", ats: "lever" },
  { name: "Copy.ai", slug: "copy-ai", ats: "lever" },
  { name: "Dagster", slug: "dagster", ats: "lever" },
  { name: "Deepgram", slug: "deepgram", ats: "lever" },
  { name: "Hopin", slug: "hopin", ats: "lever" },
  { name: "Jasper", slug: "jasper", ats: "lever" },
  { name: "Replit", slug: "replit", ats: "lever" },
  { name: "Runway", slug: "runway", ats: "lever" },
  { name: "Stability AI", slug: "stability", ats: "lever" },
  { name: "Synthesia", slug: "synthesia", ats: "lever" },
  { name: "TabNine", slug: "tabnine", ats: "lever" },
  { name: "Together AI", slug: "together-ai", ats: "lever" },
  { name: "Tome", slug: "tome", ats: "lever" },
  { name: "Vouch", slug: "vouch", ats: "lever" },
  { name: "Writer", slug: "writer", ats: "lever" },

  // ── SmartRecruiters ──
  { name: "Sodexo", slug: "sodexo", ats: "smartrecruiters" },
  { name: "Continental", slug: "continental", ats: "smartrecruiters" },
  { name: "Kimberly-Clark", slug: "kimberlyclark", ats: "smartrecruiters" },
  { name: "Delivery Hero", slug: "deliveryhero", ats: "smartrecruiters" },
  { name: "ASOS", slug: "asos", ats: "smartrecruiters" },
  { name: "Accor", slug: "accor", ats: "smartrecruiters" },
  { name: "Wayfair", slug: "wayfair", ats: "smartrecruiters" },
  { name: "Domino's", slug: "dominos", ats: "smartrecruiters" },
  { name: "Swiggy", slug: "swiggy", ats: "smartrecruiters" },
  { name: "Wise", slug: "wise", ats: "smartrecruiters" },
  { name: "Thales", slug: "thales", ats: "smartrecruiters" },
  { name: "GEICO", slug: "geico", ats: "smartrecruiters" },
  { name: "Entain", slug: "entain", ats: "smartrecruiters" },
  { name: "Primark", slug: "primark", ats: "smartrecruiters" },
  { name: "Caffè Nero", slug: "caffenero", ats: "smartrecruiters" },
  { name: "Eurofins", slug: "eurofins", ats: "smartrecruiters" },
  { name: "Colliers", slug: "colliers", ats: "smartrecruiters" },

  // ── Ashby ──
  { name: "Perplexity", slug: "perplexity", ats: "ashby" },
  { name: "Character.AI", slug: "character", ats: "ashby" },
  { name: "Cognition (Devin)", slug: "cognition", ats: "ashby" },
  { name: "Semgrep", slug: "semgrep", ats: "ashby" },
  { name: "Resend", slug: "resend", ats: "ashby" },
  { name: "Cursor (Anysphere)", slug: "cursor", ats: "ashby" },
  { name: "Weaviate", slug: "weaviate", ats: "ashby" },
  { name: "Stytch", slug: "stytch", ats: "ashby" },
  { name: "WorkOS", slug: "workos", ats: "ashby" },
  { name: "Browserbase", slug: "browserbase", ats: "ashby" },
  { name: "Neon", slug: "neon", ats: "ashby" },
  { name: "Dune", slug: "dune", ats: "ashby" },
  { name: "Gumloop", slug: "gumloop", ats: "ashby" },
];

/**
 * Search companies by a query string. Case-insensitive partial match on name.
 */
export function searchCompanies(query: string): CompanyEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return COMPANIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 15);
}

/**
 * Look up a company by slug. Returns undefined if not found.
 */
export function getCompanyBySlug(slug: string): CompanyEntry | undefined {
  return COMPANIES.find((c) => c.slug === slug);
}

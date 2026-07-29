import { neon } from "@neondatabase/serverless";

/**
 * Lazily initialize and cache the Neon SQL connection.
 * Caching is critical — creating a new neon() instance on every query causes
 * prepared-statement name collisions because each instance starts naming from s0.
 * A single cached instance ensures all queries share the same connection context.
 */
let _sql: ReturnType<typeof neon> | null = null;
function getSql(): ReturnType<typeof neon> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — connect a database (via the database card) before running queries.",
    );
  }
  _sql = neon(url);
  return _sql;
}

/**
 * Dual-mode SQL helper — supports both tagged-template and raw-string calls:
 *
 *   // Tagged template (safe, parameterised):
 *   const rows = await sql`select id from posts where id = ${id}`;
 *
 *   // Raw SQL string (for dynamic queries built at runtime):
 *   const rows = await sql("SELECT id FROM posts WHERE id = $1", id);
 *
 * Never import this from client code — it exposes the database connection.
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): ReturnType<ReturnType<typeof neon>>;
export function sql(queryString: string, ...params: unknown[]): ReturnType<ReturnType<typeof neon>>;
export function sql(first: string | TemplateStringsArray, ...rest: unknown[]): ReturnType<ReturnType<typeof neon>> {
  if (typeof first === "string") {
    // Raw SQL string call — use .query() for parameterised queries
    return getSql().query(first, rest) as ReturnType<ReturnType<typeof neon>>;
  }
  // Tagged template call
  return getSql()(first, ...rest);
}

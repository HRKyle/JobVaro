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
 * Whether an error is a transient connection failure worth retrying.
 *
 * The Neon SQL-over-HTTP driver wraps ANY fetch error as
 * "Error connecting to database: …" (index.mjs ~line 1291-1292) and has no
 * built-in retry. The underlying fetch abort is transient — Neon endpoint cold
 * start / contention — and the wrapped error's `.sourceError` carries the real
 * DOMException whose name is "TimeoutError" (or "AbortError"). Retrying the
 * same query almost always succeeds immediately. Anything else (syntax errors,
 * unique violations, auth failures) must surface immediately, never be retried.
 */
function isTransientConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & { sourceError?: { name?: string } };
  return (
    e.name === "TimeoutError" ||
    e.name === "AbortError" ||
    e.sourceError?.name === "TimeoutError" ||
    e.sourceError?.name === "AbortError" ||
    e.message.includes("Error connecting to database")
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute a query with up to 2 retries (short backoff) when it fails with a
 * transient Neon connection timeout. All other errors are re-thrown unchanged.
 */
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  const backoffs = [150, 400];
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (!isTransientConnectionError(err) || attempt >= backoffs.length) throw err;
      await sleep(backoffs[attempt] as number);
    }
  }
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
    return withRetry(() => getSql().query(first, rest)) as ReturnType<ReturnType<typeof neon>>;
  }
  // Tagged template call
  return withRetry(() => getSql()(first, ...rest));
}

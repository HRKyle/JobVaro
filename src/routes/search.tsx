import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  searchJobs,
  saveJob,
  unsaveJob,
  getDistinctSources,
  type JobResult,
  type SearchResponse,
} from "~/services/jobs";
import { getCurrentUser, type AuthUser } from "~/auth/functions";

// ── Server loader ────────────────────────────────────────────────────────────

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "JobHub";
  } catch {
    return "JobHub";
  }
});

const initialSearch = createServerFn({ method: "GET" }).handler(
  async ({ data }): Promise<SearchResponse> => {
    return searchJobs({ data: data as Record<string, unknown> });
  },
);

const fetchSources = createServerFn({ method: "GET" }).handler(async () => {
  return getDistinctSources();
});

export const Route = createFileRoute("/search")({
  loader: async () => {
    const [businessName, userResult, results, sources] = await Promise.all([
      getBusinessName(),
      getCurrentUser(),
      initialSearch({ data: {} }),
      fetchSources(),
    ]);
    return {
      businessName,
      user: userResult.user,
      initialResults: results,
      sources,
    };
  },
  component: SearchPage,
});

// ── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek === 1) return "1 week ago";
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth === 1) return "1 month ago";
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return date.toLocaleDateString();
}

// ── Truncate helper ──────────────────────────────────────────────────────────

function truncate(text: string | null, maxLen: number): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

// ── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <div className="mb-3 h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mb-2 h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mb-2 h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mb-3 h-12 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="flex gap-2">
        <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

// ── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  user,
  onSave,
  onUnsave,
}: {
  job: JobResult;
  user: AuthUser | null;
  onSave: (job: JobResult) => void;
  onUnsave: (jobId: string) => void;
}) {
  const isRemote = job.location?.toLowerCase().includes("remote");
  const sourceLabel = job.source
    ? `via ${job.source.charAt(0).toUpperCase() + job.source.slice(1)}`
    : "";

  const handleSaveToggle = useCallback(async () => {
    if (!user) return;
    if (job.is_saved) {
      await unsaveJob({ data: { jobId: job.id } });
      onUnsave(job.id);
    } else {
      await saveJob({
        data: {
          title: job.title,
          company: job.company,
          location: job.location ?? undefined,
          description: job.description ?? undefined,
          url: job.url ?? undefined,
          source: job.source ?? undefined,
          salary: job.salary ?? undefined,
          posted_at: job.posted_at ?? undefined,
          external_id: job.id,
        },
      });
      onSave(job);
    }
  }, [job, user, onSave, onUnsave]);

  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      {/* Title */}
      <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {job.title}
          </a>
        ) : (
          job.title
        )}
      </h3>

      {/* Company & Location */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium">{job.company}</span>
        {job.location && (
          <span className="inline-flex items-center gap-1">
            {isRemote ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {job.location}
          </span>
        )}
      </div>

      {/* Salary */}
      {job.salary && (
        <p className="mb-2 text-sm font-medium text-green-700 dark:text-green-400">
          {job.salary}
        </p>
      )}

      {/* Description */}
      {job.description && (
        <p className="mb-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {truncate(job.description, 180)}
        </p>
      )}

      {/* Footer row: source, time, actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {sourceLabel && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {sourceLabel}
            </span>
          )}
          {job.posted_at && (
            <span className="text-gray-400 dark:text-gray-500">
              {relativeTime(job.posted_at)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Save button */}
          {user && (
            <button
              type="button"
              onClick={handleSaveToggle}
              title={job.is_saved ? "Unsave" : "Save"}
              className={`rounded-lg p-1.5 transition ${
                job.is_saved
                  ? "text-pink-600 hover:bg-pink-50 dark:text-pink-400 dark:hover:bg-pink-950"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              }`}
            >
              <svg className="h-5 w-5" fill={job.is_saved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}

          {/* Track application button */}
          <a
            href={`/track?title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}`}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
          >
            Track
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main page component ──────────────────────────────────────────────────────

function SearchPage() {
  const { user: initialUser, initialResults, sources: sourceOptions } =
    Route.useLoaderData();

  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [searchText, setSearchText] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "company">("newest");
  const [filter, setFilter] = useState<"all" | "watchlist">("all");
  const [results, setResults] = useState<SearchResponse>(initialResults);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSearchText = useRef("");

  // Fetch results
  const fetchResults = useCallback(
    async (params: {
      search: string;
      source: string;
      location: string;
      sort: string;
      page: number;
      filter: string;
    }) => {
      setLoading(true);
      try {
        const res = await searchJobs({
          data: {
            search: params.search,
            source: params.source,
            location: params.location,
            sort: params.sort as "newest" | "oldest" | "company",
            page: params.page,
            filter: params.filter as "all" | "watchlist",
          },
        });
        setResults(res);
      } catch {
        // Keep existing results on error
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (debouncedSearchText.current !== searchText) {
        debouncedSearchText.current = searchText;
        setPage(1);
        fetchResults({
          search: searchText,
          source: sourceFilter,
          location: locationFilter,
          sort,
          page: 1,
          filter,
        });
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText]);

  // Non-debounced filter changes
  const doSearch = useCallback(
    (overrides: Partial<{ search: string; source: string; location: string; sort: string; page: number; filter: string }>) => {
      const s = overrides.search ?? searchText;
      const so = overrides.source ?? sourceFilter;
      const l = overrides.location ?? locationFilter;
      const sr = overrides.sort ?? sort;
      const p = overrides.page ?? 1;
      const f = overrides.filter ?? filter;

      debouncedSearchText.current = s;
      setPage(p);
      fetchResults({ search: s, source: so, location: l, sort: sr, page: p, filter: f });
    },
    [searchText, sourceFilter, locationFilter, sort, filter, fetchResults],
  );

  const handleSourceChange = useCallback(
    (val: string) => {
      setSourceFilter(val);
      doSearch({ source: val, page: 1 });
    },
    [doSearch],
  );

  const handleLocationInput = useCallback(
    (val: string) => {
      setLocationFilter(val);
    },
    [],
  );

  const handleLocationKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        doSearch({ location: locationFilter, page: 1 });
      }
    },
    [doSearch, locationFilter],
  );

  const handleSortChange = useCallback(
    (val: "newest" | "oldest" | "company") => {
      setSort(val);
      doSearch({ sort: val, page: 1 });
    },
    [doSearch],
  );

  const handleFilterChange = useCallback(
    (val: "all" | "watchlist") => {
      setFilter(val);
      doSearch({ filter: val, page: 1 });
    },
    [doSearch],
  );

  const handleSave = useCallback((job: JobResult) => {
    setResults((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => (j.id === job.id ? { ...j, is_saved: true } : j)),
    }));
  }, []);

  const handleUnsave = useCallback((jobId: string) => {
    setResults((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => (j.id === jobId ? { ...j, is_saved: false } : j)),
    }));
  }, []);

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    doSearch({ page: nextPage });
  }, [page, doSearch]);

  const hasMore = page < results.totalPages;

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      {/* Search header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl space-y-4">
          {/* Search bar */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search jobs by title, company, or keyword…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter tabs */}
            <div className="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-700">
              <button
                type="button"
                onClick={() => handleFilterChange("all")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  filter === "all"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                All Jobs
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("watchlist")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  filter === "watchlist"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                My Companies
              </button>
            </div>

            {/* Source filter */}
            <select
              value={sourceFilter}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="">All sources</option>
              {sourceOptions.map((src) => (
                <option key={src} value={src}>
                  {src.charAt(0).toUpperCase() + src.slice(1)}
                </option>
              ))}
            </select>

            {/* Location filter */}
            <input
              type="text"
              placeholder="Location…"
              value={locationFilter}
              onChange={(e) => handleLocationInput(e.target.value)}
              onKeyDown={handleLocationKeyDown}
              className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
            />

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value as "newest" | "oldest" | "company")}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="company">Company A-Z</option>
            </select>

            {/* Result count */}
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {results.total} job{results.total !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Loading state */}
        {loading && results.jobs.length === 0 && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && results.jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg
              className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h3 className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">
              No jobs found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your filters or search terms.
            </p>
          </div>
        )}

        {/* Job cards */}
        {results.jobs.length > 0 && (
          <div className="space-y-4">
            {results.jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                user={user}
                onSave={handleSave}
                onUnsave={handleUnsave}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {loading ? "Loading…" : "Load more jobs"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

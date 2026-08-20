import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentUser, type AuthUser } from "~/auth/functions";
import {
  searchCompanies,
  followCompany,
  unfollowCompany,
  getWatchlist,
} from "~/services/companies";
import type { CompanyEntry } from "~/data/companies";
import { toast } from "~/components/toast";

export const Route = createFileRoute("/companies")({
  loader: async () => {
    const [userResult, watchlistResult, searchResult] = await Promise.all([
      getCurrentUser(),
      getWatchlist(),
      searchCompanies({ data: { query: "" } }),
    ]);
    return {
      user: userResult.user,
      watchlist: watchlistResult.companies,
      initialSearch: searchResult,
    };
  },
  component: CompaniesPage,
});

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
        >
          <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1">
            <div className="mb-1 h-5 w-40 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="h-8 w-24 rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

// ── Company card ─────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  isFollowed,
  onToggle,
}: {
  company: CompanyEntry;
  isFollowed: boolean;
  onToggle: (company: CompanyEntry, follow: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    setLoading(true);
    try {
      await onToggle(company, !isFollowed);
    } finally {
      setLoading(false);
    }
  }, [company, isFollowed, onToggle]);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      {/* Avatar placeholder */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
        {company.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
          {company.name}
        </h4>
        <div className="flex items-center gap-2">
          {company.ats !== "none" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              ATS Available
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Manual
            </span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {company.ats === "greenhouse"
              ? "Greenhouse"
              : company.ats === "lever"
                ? "Lever"
                : company.ats === "smartrecruiters"
                  ? "SmartRecruiters"
                  : company.ats === "ashby"
                    ? "Ashby"
                    : ""}
          </span>
        </div>
      </div>

      {/* Follow toggle */}
      <button
        type="button"
        disabled={loading}
        onClick={handleToggle}
        className={`relative flex-shrink-0 overflow-hidden rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-300 disabled:opacity-50 ${
          isFollowed
            ? "bg-green-100 text-green-700 ring-1 ring-green-200 hover:bg-red-50 hover:text-red-600 hover:ring-red-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-900 dark:hover:bg-red-950 dark:hover:text-red-400 dark:hover:ring-red-900"
            : "bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-sm shadow-indigo-500/25 hover:shadow-md hover:brightness-110"
        }`}
      >
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            ...
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            {isFollowed ? (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Following
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Follow
              </>
            )}
          </span>
        )}
      </button>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

function CompaniesPage() {
  const { user, watchlist: initialWatchlist } = Route.useLoaderData();

  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<CompanyEntry[]>([]);
  const [followed, setFollowed] = useState<string[]>(
    initialWatchlist.map((c) => c.slug),
  );
  const [watchlist, setWatchlist] = useState<CompanyEntry[]>(initialWatchlist);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchText.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchCompanies({ data: { query: searchText } });
        setResults(res.companies);
        // Update followed state from server
        setFollowed(res.followed);
        setShowDropdown(res.companies.length > 0);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Toggle follow/unfollow
  const handleToggle = useCallback(
    async (company: CompanyEntry, shouldFollow: boolean) => {
      if (shouldFollow) {
        const result = await followCompany({
          data: { companyName: company.name, companySlug: company.slug },
        });
        if (result.success) {
          setFollowed((prev) => [...prev, company.slug]);
          toast(
            result.jobsFetched
              ? `Added · Fetching ${result.jobsFetched} job${result.jobsFetched !== 1 ? "s" : ""}`
              : "Company added to watchlist",
          );
          // Refresh watchlist
          const wl = await getWatchlist();
          setWatchlist(wl.companies);
        }
      } else {
        const result = await unfollowCompany({ data: { companySlug: company.slug } });
        if (result.success) {
          setFollowed((prev) => prev.filter((s) => s !== company.slug));
          toast("Company removed from watchlist", "info");
          const wl = await getWatchlist();
          setWatchlist(wl.companies);
        }
      }
    },
    [],
  );

  // Follow an arbitrary free-text company name (no curated match needed).
  const handleFollowByName = useCallback(
    async (name: string) => {
      setLoading(true);
      try {
        const slug = name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        const result = await followCompany({ data: { companyName: name, companySlug: slug } });
        if (result.success) {
          setFollowed((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
          toast(
            result.jobsFetched
              ? `Added · Fetching ${result.jobsFetched} job${result.jobsFetched !== 1 ? "s" : ""}`
              : "Company added to watchlist",
          );
          setShowDropdown(false);
          setSearchText("");
          const wl = await getWatchlist();
          setWatchlist(wl.companies);
          const res = await searchCompanies({ data: { query: "" } });
          setResults([]);
          setFollowed(res.followed);
        } else {
          toast(result.error ?? "Failed to add company", "error");
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSelect = useCallback(
    async (company: CompanyEntry) => {
      const isFollowed = followed.includes(company.slug);
      let result: { success: boolean; error?: string; jobsFetched?: number };
      if (isFollowed) {
        result = await unfollowCompany({ data: { companySlug: company.slug } });
      } else {
        result = await followCompany({
          data: { companyName: company.name, companySlug: company.slug },
        });
      }
      if (!result.success) {
        // Server rejected the action — silently skip the optimistic update
        // and refresh from server to get the authoritative state.
        const wl = await getWatchlist();
        setWatchlist(wl.companies);
        const res = await searchCompanies({ data: { query: searchText } });
        setResults(res.companies);
        setFollowed(res.followed);
        return;
      }
      if (isFollowed) {
        setFollowed((prev) => prev.filter((s) => s !== company.slug));
      } else {
        setFollowed((prev) => [...prev, company.slug]);
        if (result.jobsFetched) {
          toast(`Fetching ${result.jobsFetched} job${result.jobsFetched !== 1 ? "s" : ""}`);
        }
      }
      const wl = await getWatchlist();
      setWatchlist(wl.companies);
      // Update results
      const res = await searchCompanies({ data: { query: searchText } });
      setResults(res.companies);
      setFollowed(res.followed);
    },
    [followed, searchText],
  );

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Company Watchlist
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Follow companies to see their latest job openings pulled from free
            ATS feeds.
          </p>
        </div>

        {/* Search */}
        <div ref={containerRef} className="relative mb-8">
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
              ref={inputRef}
              type="text"
              placeholder="Search for companies to follow…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onFocus={() => {
                if (results.length > 0) setShowDropdown(true);
              }}
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            {loading && (
              <svg
                className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
          </div>

          {/* Dropdown results */}
          {showDropdown && searchText.trim() && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/40">
              <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:text-gray-500">
                Results
              </div>
              {results.length === 0 && !loading ? (
                <div className="px-4 py-3">
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    No companies found in the curated list.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleFollowByName(searchText)}
                    className="flex w-full items-center gap-3 rounded-lg bg-sky-50 px-3 py-2.5 text-left text-sm font-medium text-sky-700 transition hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-900"
                  >
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add "{searchText}" to watchlist
                  </button>
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    Custom companies are tracked manually — no auto-fetched jobs.
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto py-1">
                  {results.map((company) => {
                    const isFollowed = followed.includes(company.slug);
                    return (
                      <button
                        key={company.slug}
                        type="button"
                        onClick={() => handleSelect(company)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                          {company.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {company.name}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {company.ats !== "none" ? "ATS Available" : "Manual"}
                          </div>
                        </div>
                        <span
                          className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isFollowed
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400"
                          }`}
                        >
                          {isFollowed ? "Following" : "Follow"}
                        </span>
                      </button>
                    );
                  })}
                  {/* Manual-add footer: follow any query as a custom company */}
                  <div className="mt-1 border-t border-gray-100 px-4 py-2 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => handleFollowByName(searchText)}
                      className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-xs font-medium text-sky-700 transition hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950"
                    >
                      <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add "{searchText}" as a custom company (Manual)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* My Watchlist section */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            My Watchlist
            {watchlist.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({watchlist.length})
              </span>
            )}
          </h2>

          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
              <svg
                className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="mb-2 font-semibold text-gray-700 dark:text-gray-300">
                No companies followed
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Search above to find companies and add them to your watchlist.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {watchlist.map((company) => (
                <CompanyCard
                  key={company.slug}
                  company={company}
                  isFollowed={true}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

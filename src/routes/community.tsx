import { createFileRoute } from "@tanstack/react-router";
import {
  useState,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";
import { getCurrentUser } from "~/auth/functions";
import {
  getCommunityJobs,
  shareJob,
  deleteCommunityJob,
  type CommunityJob,
} from "~/services/community";
import { toast } from "~/components/toast";

export const Route = createFileRoute("/community")({
  loader: async () => {
    const [userResult, initialJobs] = await Promise.all([
      getCurrentUser(),
      getCommunityJobs(),
    ]);
    return { user: userResult.user, initialJobs };
  },
  component: CommunityPage,
});

// ── Relative time helper ────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function excerpt(text: string | null, maxLen = 150): string | null {
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

// ── Skeleton cards ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mb-3 h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

// ── Share form modal ────────────────────────────────────────────────────────

function ShareForm({
  onShared,
  onCancel,
}: {
  onShared: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [salary, setSalary] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError("");

      if (!title.trim()) {
        setError("Job title is required.");
        return;
      }
      if (!company.trim()) {
        setError("Company is required.");
        return;
      }

      setLoading(true);
      try {
        const result = await shareJob({
          data: {
            title: title.trim(),
            company: company.trim(),
            location: location.trim() || undefined,
            url: url.trim() || undefined,
            salary: salary.trim() || undefined,
            description: description.trim() || undefined,
            source: "community",
          },
        });
        if (!result.success) {
          setError(result.error ?? "Failed to share job.");
          setLoading(false);
          return;
        }
        onShared();
      } catch {
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [title, company, location, url, salary, description, onShared],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pt-[8vh]">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      {/* Modal */}
      <div className="relative z-10 mx-4 w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between border-b border-gray-100 px-6 pb-4 pt-6 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 0V16.5a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
            </span>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Share a Job
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 pb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="share-title"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                id="share-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                placeholder="e.g. Senior Frontend Engineer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="share-company"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Company <span className="text-red-500">*</span>
              </label>
              <input
                id="share-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                placeholder="e.g. Acme Inc."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="share-location"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Location
              </label>
              <input
                id="share-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                placeholder="e.g. San Francisco, CA"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="share-salary"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Salary
              </label>
              <input
                id="share-salary"
                type="text"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                placeholder="e.g. $120K – $150K"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="share-url"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Job URL
            </label>
            <input
              id="share-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="https://..."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="share-description"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Description
            </label>
            <textarea
              id="share-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Brief description of the role..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Sharing…" : "Share Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Job card ────────────────────────────────────────────────────────────────

function JobCard({
  job,
  currentUserId,
  onDeleted,
}: {
  job: CommunityJob;
  currentUserId: string | null;
  onDeleted: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = currentUserId && job.user_id === currentUserId;

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const result = await deleteCommunityJob({ data: { id: job.id } });
      if (result.success) {
        onDeleted();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }, [job.id, onDeleted]);

  const titleContent = job.url ? (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
    >
      {job.title}
    </a>
  ) : (
    <span className="font-semibold text-gray-900 dark:text-gray-100">
      {job.title}
    </span>
  );

  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold tracking-tight">{titleContent}</h3>
          <p className="mt-0.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            {job.company}
          </p>
        </div>
        {isOwner && (
          <div className="flex-shrink-0">
            {!showDelete ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="rounded-lg p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                title="Delete"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="text-red-600 dark:text-red-400">Delete?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded bg-red-600 px-1.5 py-0.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "…" : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDelete(false)}
                  className="rounded bg-gray-200 px-1.5 py-0.5 font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
                >
                  No
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {job.location}
          </span>
        )}
        {job.salary && (
          <span className="inline-flex items-center gap-1">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {job.salary}
          </span>
        )}
        {job.source && job.source !== "community" && (
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
            {job.source}
          </span>
        )}
        <span>{relativeTime(job.posted_at)}</span>
        {job.user_name && (
          <span className="inline-flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-[9px] font-bold text-indigo-600 dark:from-indigo-900 dark:to-violet-900 dark:text-indigo-300">
              {job.user_name.charAt(0).toUpperCase()}
            </span>
            shared by {job.user_name}
          </span>
        )}
      </div>

      {/* Description excerpt */}
      {job.description && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {excerpt(job.description)}
        </p>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

function CommunityPage() {
  const { user, initialJobs } = Route.useLoaderData();

  const [jobs, setJobs] = useState<CommunityJob[]>(initialJobs.jobs);
  const [total, setTotal] = useState(initialJobs.total);
  const [page, setPage] = useState(initialJobs.page);
  const [totalPages, setTotalPages] = useState(initialJobs.totalPages);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showShareForm, setShowShareForm] = useState(false);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch jobs when search or page changes
  useEffect(() => {
    let cancelled = false;
    async function fetchJobs() {
      setLoading(true);
      try {
        const result = await getCommunityJobs({
          data: { search: search || undefined, page },
        });
        if (!cancelled) {
          setJobs(result.jobs);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchJobs();
    return () => {
      cancelled = true;
    };
  }, [search, page]);

  const handleShared = useCallback(async () => {
    setShowShareForm(false);
    setPage(1);
    toast("Job shared with the community");
    const result = await getCommunityJobs({
      data: { search: search || undefined, page: 1 },
    });
    setJobs(result.jobs);
    setTotal(result.total);
    setTotalPages(result.totalPages);
  }, [search]);

  const handleDeleted = useCallback(async () => {
    toast("Job removed", "info");
    const result = await getCommunityJobs({
      data: { search: search || undefined, page },
    });
    setJobs(result.jobs);
    setTotal(result.total);
    setTotalPages(result.totalPages);
  }, [search, page]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) {
      setPage((p) => p + 1);
    }
  }, [page, totalPages]);

  // When search changes, reset to page 1
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      setPage(1);
    },
    [],
  );

  const isLoading = loading && jobs.length === 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Community Jobs
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Browse jobs shared by the JobVaro community
          </p>
        </div>
        {user ? (
          <button
            type="button"
            onClick={() => setShowShareForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110 active:scale-95"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Share a Job
          </button>
        ) : (
          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110"
          >
            Sign in to Share
          </a>
        )}
      </div>

      {/* Search bar */}
      <div className="mb-8">
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
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search jobs by title, company, or description…"
            className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-indigo-900"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : jobs.length === 0 ? (
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
              strokeWidth={1}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          {search ? (
            <>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                No jobs found
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Try a different search term.
              </p>
            </>
          ) : (
            <>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                No jobs shared yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Be the first to share a job with the community!
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                currentUserId={user?.id ?? null}
                onDeleted={handleDeleted}
              />
            ))}
          </div>

          {/* Load more / pagination */}
          {page < totalPages && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {loading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
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
                    Loading…
                  </>
                ) : (
                  "Load more jobs"
                )}
              </button>
            </div>
          )}

          {/* Job count */}
          {total > 0 && (
            <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
              Showing {jobs.length} of {total} job{total !== 1 ? "s" : ""}
            </p>
          )}
        </>
      )}

      {/* Share form modal */}
      {showShareForm && (
        <ShareForm
          onShared={handleShared}
          onCancel={() => setShowShareForm(false)}
        />
      )}
    </main>
  );
}

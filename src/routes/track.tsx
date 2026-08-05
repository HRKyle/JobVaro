import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import { getCurrentUser, type AuthUser } from "~/auth/functions";
import type { ApplicationStatus } from "~/services/applications";
import {
  getApplications,
  createApplication,
  updateApplication,
  updateApplicationStatus,
  deleteApplication,
  addApplicationEvent,
  APPLICATION_STATUSES,
  type Application,
  type ApplicationEvent,
  type CreateApplicationInput,
} from "~/services/applications";
import { extractJobFromUrl, type ExtractedJobData } from "~/services/url-parser";
import { StatusBadge, statusLabel } from "~/components/StatusBadge";
import { shareJob } from "~/services/community";
import { BookmarkletInstructionsCompact } from "~/components/BookmarkletInstructions";
import { AuthForms } from "~/components/AuthForms";
import { toast } from "~/components/toast";

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

export const Route = createFileRoute("/track")({
  loader: async () => {
    const [businessName, userResult, applications] = await Promise.all([
      getBusinessName(),
      getCurrentUser(),
      getApplications(),
    ]);
    return { businessName, user: userResult.user, applications };
  },
  component: TrackPage,
});

// ── Filter types ─────────────────────────────────────────────────────────────

type StatusFilter = "all" | "applied" | "interview" | "offer" | "rejected";

/** Accent color for the left bar on application cards */
const STATUS_ACCENT: Record<string, string> = {
  saved: "bg-gray-400 dark:bg-gray-500",
  applied: "bg-blue-500",
  phone_screen: "bg-violet-500",
  interview: "bg-purple-500",
  technical: "bg-indigo-500",
  offer: "bg-green-500",
  accepted: "bg-emerald-500",
  rejected: "bg-red-500",
  withdrawn: "bg-orange-500",
};

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "applied", label: "Applied" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
];

function filterApps(apps: Application[], f: StatusFilter): Application[] {
  if (f === "all") return apps;
  if (f === "applied")
    return apps.filter((a) =>
      ["saved", "applied", "phone_screen"].includes(a.status),
    );
  if (f === "interview")
    return apps.filter((a) =>
      ["interview", "technical"].includes(a.status),
    );
  if (f === "offer")
    return apps.filter((a) => ["offer", "accepted"].includes(a.status));
  if (f === "rejected")
    return apps.filter((a) =>
      ["rejected", "withdrawn"].includes(a.status),
    );
  return apps;
}

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

// ── Stats ───────────────────────────────────────────────────────────────────

interface Stats {
  total: number;
  active: number;
  interviews: number;
  offers: number;
}

function computeStats(apps: Application[]): Stats {
  return {
    total: apps.length,
    active: apps.filter((a) =>
      ["saved", "applied", "phone_screen", "interview", "technical"].includes(
        a.status,
      ),
    ).length,
    interviews: apps.filter((a) =>
      ["interview", "technical"].includes(a.status),
    ).length,
    offers: apps.filter((a) => ["offer", "accepted"].includes(a.status)).length,
  };
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

// ── Application form (modal) ─────────────────────────────────────────────────

interface FormPrefillData {
  title?: string;
  company?: string;
  description?: string;
  url?: string;
  app?: Application;
}

function AppForm({
  user,
  initial,
  onSaved,
  onCancel,
}: {
  user: AuthUser;
  initial?: FormPrefillData;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!initial?.app;
  const [jobTitle, setJobTitle] = useState(
    initial?.app?.job_title ?? initial?.title ?? "",
  );
  const [company, setCompany] = useState(
    initial?.app?.company ?? initial?.company ?? "",
  );
  const [jobUrl, setJobUrl] = useState(
    initial?.app?.job_url ?? initial?.url ?? "",
  );
  const [status, setStatus] = useState<ApplicationStatus>(
    initial?.app?.status ?? "applied",
  );
  const [notes, setNotes] = useState(initial?.app?.notes ?? "");
  const [followUpAt, setFollowUpAt] = useState(
    initial?.app?.follow_up_at ? initial.app.follow_up_at.slice(0, 10) : "",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shareToCommunity, setShareToCommunity] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError("");

      if (!jobTitle.trim()) {
        setError("Job title is required.");
        return;
      }
      if (!company.trim()) {
        setError("Company is required.");
        return;
      }

      setLoading(true);
      try {
        if (isEdit && initial?.app) {
          if (status !== initial.app.status) {
            await updateApplicationStatus({
              data: {
                id: initial.app.id,
                status,
                notes: notes || undefined,
              },
            });
          }
          await updateApplication({
            data: {
              id: initial.app.id,
              notes: notes || undefined,
              follow_up_at: followUpAt || undefined,
            },
          });
        } else {
          const input: CreateApplicationInput = {
            job_title: jobTitle.trim(),
            company: company.trim(),
            status,
            notes: notes.trim() || undefined,
            follow_up_at: followUpAt || undefined,
            job_url: jobUrl.trim() || undefined,
          };
          const result = await createApplication({ data: input });
          if (!result.success) {
            setError(result.error ?? "Failed to create.");
            setLoading(false);
            return;
          }
          // If "Share to Community" is checked, share the job
          if (shareToCommunity) {
            await shareJob({
              data: {
                title: jobTitle.trim(),
                company: company.trim(),
                url: jobUrl.trim() || undefined,
                description: notes.trim() || undefined,
                source: "tracker",
              },
            });
          }
        }
        onSaved();
      } catch {
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [jobTitle, company, jobUrl, status, notes, followUpAt, isEdit, initial, onSaved, shareToCommunity],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pt-[8vh]">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      {/* Modal */}
      <div className="relative z-10 mx-4 w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25">
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {isEdit ? "Edit Application" : "Add Application"}
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 pb-6">
          {/* Section: Position */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Position
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="app-job-title"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                ref={titleRef}
                id="app-job-title"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                placeholder="e.g. Senior Engineer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="app-company"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Company <span className="text-red-500">*</span>
              </label>
              <input
                id="app-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                placeholder="e.g. Acme Inc."
              />
            </div>
          </div>
          </div>

          {/* Section: Details */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Details
            </h3>
            <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="app-url"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Job URL
            </label>
            <input
              id="app-url"
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="https://..."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="app-status"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Status
            </label>
            <select
              id="app-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="app-follow-up"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Follow-up date
            </label>
            <input
              id="app-follow-up"
              type="date"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
            </div>
          </div>

          {/* Section: Notes */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Notes
            </h3>
            <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="app-notes"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Notes
            </label>
            <textarea
              id="app-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Any notes about this application..."
            />
          </div>
            </div>
          </div>

          {!isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shareToCommunity}
                onChange={(e) => setShareToCommunity(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Also share to community
              </span>
            </label>
          )}

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
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Quick Add section ────────────────────────────────────────────────────────

function QuickAdd({
  onExtracted,
}: {
  onExtracted: (data: ExtractedJobData) => void;
}) {
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");

  const handleExtract = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a URL.");
      return;
    }

    // Basic URL validation
    try {
      new URL(trimmed);
    } catch {
      setError("Please enter a valid URL.");
      return;
    }

    setError("");
    setExtracting(true);
    try {
      const result = await extractJobFromUrl({ data: { url: trimmed } });
      if (result.success && result.data) {
        onExtracted(result.data);
        setUrl("");
      } else {
        setError(result.error ?? "Couldn't extract details.");
      }
    } catch {
      setError("Something went wrong. Try adding manually.");
    } finally {
      setExtracting(false);
    }
  }, [url, onExtracted]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleExtract();
      }
    },
    [handleExtract],
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50/80 to-violet-50/40 p-6 dark:border-indigo-800 dark:from-indigo-950/40 dark:to-violet-950/20">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25">
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </span>
        <div>
          <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Quick Add
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Paste a job listing URL and we&apos;ll auto-fill the details for you.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={handleKeyDown}
            placeholder="Paste a job listing URL..."
            disabled={extracting}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-indigo-900"
          />
          {extracting && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg
                className="h-5 w-5 animate-spin text-indigo-600"
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
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleExtract}
          disabled={extracting || !url.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110 disabled:opacity-50 sm:w-auto"
        >
          {extracting ? (
            "Extracting…"
          ) : (
            <>
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
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Extract
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ── Timeline panel ──────────────────────────────────────────────────────────

function TimelinePanel({ events }: { events: ApplicationEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">No events yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((ev) => (
        <div key={ev.id} className="flex gap-3 text-sm">
          <div className="relative mt-1 flex-shrink-0">
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            <div className="absolute left-1 top-2 h-full w-px bg-gray-200 last:hidden dark:bg-gray-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {ev.event_type
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {relativeTime(ev.event_date)}
              </span>
            </div>
            {ev.notes && (
              <p className="mt-0.5 text-gray-600 dark:text-gray-400">
                {ev.notes}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Application card ────────────────────────────────────────────────────────

function AppCard({
  app,
  onUpdate,
  onEdit,
}: {
  app: Application;
  onUpdate: () => void;
  onEdit: (app: Application) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [events, setEvents] = useState<ApplicationEvent[]>(app.events ?? []);
  const [eventsLoaded, setEventsLoaded] = useState(app.events.length > 0);
  const [newEventType, setNewEventType] = useState("note");
  const [newEventNotes, setNewEventNotes] = useState("");
  const [eventLoading, setEventLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const loadEvents = useCallback(async () => {
    if (eventsLoaded) return;
    const { getApplication } = await import("~/services/applications");
    const result = await getApplication({ data: { id: app.id } });
    if (result) {
      setEvents(result.events);
      setEventsLoaded(true);
    }
  }, [app.id, eventsLoaded]);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => {
      if (!prev) {
        loadEvents();
      }
      return !prev;
    });
  }, [loadEvents]);

  const handleAddEvent = useCallback(async () => {
    if (!newEventNotes.trim()) return;
    setEventLoading(true);
    try {
      const result = await addApplicationEvent({
        data: {
          applicationId: app.id,
          eventType: newEventType,
          notes: newEventNotes.trim(),
        },
      });
      if (result.success && result.event) {
        setEvents((prev) => [result.event!, ...prev]);
        setNewEventNotes("");
      }
    } catch {
      // ignore
    } finally {
      setEventLoading(false);
    }
  }, [app.id, newEventType, newEventNotes]);

  const handleDelete = useCallback(async () => {
    setDeleteLoading(true);
    try {
      await deleteApplication({ data: { id: app.id } });
      toast("Application deleted", "info");
      onUpdate();
    } catch {
      setDeleteLoading(false);
    }
  }, [app.id, onUpdate]);

  const followUpDate = app.follow_up_at ? new Date(app.follow_up_at) : null;
  const followUpStr = followUpDate
    ? followUpDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      {/* Status accent bar on the left edge */}
      <span
        className={`absolute inset-y-0 left-0 w-1 ${STATUS_ACCENT[app.status] ?? "bg-gray-300 dark:bg-gray-700"}`}
        aria-hidden
      />
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full p-5 pl-6 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {app.company}
            </p>
            <h3 className="mt-0.5 truncate text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {app.job_title}
            </h3>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <StatusBadge status={app.status} />
            <svg
              className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>Updated {relativeTime(app.updated_at)}</span>
          {followUpStr && (
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Follow-up: {followUpStr}
            </span>
          )}
          {app.event_count > 0 && (
            <span>
              {app.event_count} event{app.event_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {app.notes && (
          <p className="mt-2 truncate text-sm text-gray-500 dark:text-gray-400">
            {app.notes}
          </p>
        )}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          {/* Job URL */}
          {(app.job_url || app.job_source) && (
            <div className="mb-4">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Job URL
              </h4>
              <a
                href={app.job_url ?? app.job_source ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {app.job_url ?? app.job_source}
              </a>
            </div>
          )}

          {/* Status change */}
          <div className="mb-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Status
            </h4>
            <div className="flex flex-wrap gap-2">
              {APPLICATION_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={changingStatus || s === app.status}
                  onClick={async () => {
                    setChangingStatus(true);
                    try {
                      const label = s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      await updateApplicationStatus({
                        data: { id: app.id, status: s, notes: `Changed status to ${label}` },
                      });
                      setEventsLoaded(false);
                      onUpdate();
                    } catch {
                      // ignore
                    } finally {
                      setChangingStatus(false);
                    }
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    s === app.status
                      ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-700 cursor-default"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  {s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
            {changingStatus && (
              <span className="mt-2 inline-block text-xs text-gray-400">Updating...</span>
            )}
          </div>

          {/* Notes */}
          {app.notes && (
            <div className="mb-4">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Notes
              </h4>
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {app.notes}
              </p>
            </div>
          )}

          {/* Timeline */}
          <div className="mb-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Timeline
            </h4>
            {eventsLoaded ? (
              <TimelinePanel events={events} />
            ) : (
              <div className="animate-pulse space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add event */}
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={newEventType}
                onChange={(e) => setNewEventType(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="note">Note</option>
                <option value="email_sent">Email Sent</option>
                <option value="phone_call">Phone Call</option>
                <option value="follow_up">Follow-up</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                value={newEventNotes}
                onChange={(e) => setNewEventNotes(e.target.value)}
                placeholder="Add a note…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddEvent();
                }}
              />
              <button
                type="button"
                onClick={handleAddEvent}
                disabled={eventLoading || !newEventNotes.trim()}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {eventLoading ? "…" : "Add"}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                onEdit(app);
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Edit
            </button>
            {!showDelete ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete
              </button>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="text-xs text-red-600 dark:text-red-400">
                  Sure?
                </span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? "…" : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDelete(false)}
                  className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
                >
                  No
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

function TrackPage() {
  const { user, applications: initialApps } = Route.useLoaderData();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(user);
  useEffect(() => { setCurrentUser(user); }, [user]);

  const [apps, setApps] = useState<Application[]>(initialApps ?? []);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [formPrefill, setFormPrefill] = useState<FormPrefillData>({});
  const [loading, setLoading] = useState(false);
  // Read URL params for pre-fill (deep-link from search or bookmarklet)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const title = params.get("title");
    const company = params.get("company");
    const jobUrl = params.get("url");

    // Clean URL params so they don't stick on refresh
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("title");
      url.searchParams.delete("company");
      url.searchParams.delete("url");
      window.history.replaceState({}, "", url.toString());
    };

    // Case 1: Bookmarklet — title, company, and url all present; skip extraction
    if (title && company && jobUrl) {
      // If unauthenticated, save params to sessionStorage and show sign-in form
      if (!currentUser) {
        sessionStorage.setItem(
          "bookmarkletPrefill",
          JSON.stringify({ title, company, url: jobUrl }),
        );
        return;
      }
      setFormPrefill({
        title,
        company,
        url: jobUrl,
      });
      setShowForm(true);
      cleanUrl();
      return;
    }

    // Case 2: URL only (or URL with incomplete info) — trigger extraction
    if (jobUrl && (!title || !company)) {
      cleanUrl();
      extractJobFromUrl({ data: { url: jobUrl } }).then((result) => {
        if (result.success && result.data) {
          setFormPrefill({
            title: result.data.title,
            company: result.data.company,
            description: result.data.description,
            url: result.data.url,
          });
          setShowForm(true);
        }
      }).catch(() => {});
      return;
    }

    // Case 3: Only title/company from search deep-link
    if (title || company) {
      setFormPrefill({ title: title ?? undefined, company: company ?? undefined });
      setShowForm(true);
      cleanUrl();
    }
  }, []);

  // After sign-in, restore bookmarklet prefill from sessionStorage
  useEffect(() => {
    if (!currentUser || typeof window === "undefined") return;
    const stored = sessionStorage.getItem("bookmarkletPrefill");
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      if (data.title && data.company && data.url) {
        setFormPrefill({
          title: data.title,
          company: data.company,
          url: data.url,
        });
        setShowForm(true);
      }
    } catch {
      // ignore malformed data
    }
    sessionStorage.removeItem("bookmarkletPrefill");

    // Clean URL params if still present
    const params = new URLSearchParams(window.location.search);
    if (params.has("title") || params.has("company") || params.has("url")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("title");
      url.searchParams.delete("company");
      url.searchParams.delete("url");
      window.history.replaceState({}, "", url.toString());
    }
  }, [currentUser]);

  // Refresh apps after mutations
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await getApplications();
      setApps(fresh ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFormSaved = useCallback(() => {
    setShowForm(false);
    setEditingApp(null);
    setFormPrefill({});
    toast("Application saved");
    refresh();
  }, [refresh]);

  // ── Quick Add callback ──────────────────────────────────────────────────
  const handleQuickExtracted = useCallback((data: ExtractedJobData) => {
    setEditingApp(null);
    setFormPrefill({
      title: data.title,
      company: data.company,
      description: data.description,
      url: data.url,
    });
    setShowForm(true);
  }, []);

  if (!currentUser) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Sign in to save this job
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              You&apos;ll be right back to your tracker
            </p>
          </div>
          <AuthForms onAuthSuccess={(u) => setCurrentUser(u)} />
        </div>
      </main>
    );
  }

  const filtered = filterApps(apps, filter);
  const stats = computeStats(apps);
  const isLoading = loading && apps.length === 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Your Applications
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track every job application in one place
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingApp(null);
            setFormPrefill({});
            setShowForm(true);
          }}
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
          Add Manually
        </button>
      </div>

      {/* Quick Add — always visible */}
      <div className="mb-8">
        <QuickAdd onExtracted={handleQuickExtracted} />
      </div>

      {/* Stats bar */}
      {apps.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total",
              value: stats.total,
              icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
              chip: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
            },
            {
              label: "Active",
              value: stats.active,
              icon: "M13 10V3L4 14h7v7l9-11h-7z",
              chip: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
            },
            {
              label: "Interviews",
              value: stats.interviews,
              icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
              chip: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
            },
            {
              label: "Offers",
              value: stats.offers,
              icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
              chip: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${s.chip}`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-2xl font-bold leading-none text-gray-900 dark:text-gray-100">
                  {s.value}
                </div>
                <div className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {apps.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? apps.length
                : filterApps(apps, tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  filter === tab.key
                    ? "bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-sm shadow-indigo-500/30"
                    : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700"
                }`}
              >
                {tab.label}
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    filter === tab.key
                      ? "bg-white/25 text-white"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-white/60 py-20 text-center dark:border-gray-700 dark:bg-gray-900/40">
          {/* decorative dots */}
          <div className="pointer-events-none absolute -left-6 top-8 h-24 w-24 rounded-full bg-indigo-100/70 blur-2xl dark:bg-indigo-900/30" />
          <div className="pointer-events-none absolute -right-6 bottom-8 h-24 w-24 rounded-full bg-violet-100/70 blur-2xl dark:bg-violet-900/30" />
          <div className="relative">
            <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/30">
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 opacity-50 blur-lg" />
              <span className="relative text-5xl">🗂️</span>
            </div>
            {apps.length === 0 ? (
              <>
                <h3 className="mb-2 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  No applications yet
                </h3>
                <p className="mx-auto mb-6 max-w-xs text-sm text-gray-500 dark:text-gray-400">
                  Paste a job URL above or search for jobs to start tracking!
                </p>
                <a
                  href="/search"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:brightness-110 active:scale-95"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Go to Search
                </a>
              </>
            ) : (
              <>
                <h3 className="mb-2 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  No matching applications
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Try a different filter.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onUpdate={refresh}
              onEdit={(a) => {
                setEditingApp(a);
                setFormPrefill({ title: a.job_title, company: a.company, notes: a.notes ?? undefined, url: a.job_url ?? undefined });
                setShowForm(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <AppForm
          user={currentUser}
          initial={formPrefill}
          onSaved={handleFormSaved}
          onCancel={() => {
            setShowForm(false);
            setEditingApp(null);
            setFormPrefill({});
          }}
        />
      )}

      {/* Bookmarklet — Save Jobs From Anywhere */}
      <BookmarkletInstructionsCompact />
    </main>
  );
}

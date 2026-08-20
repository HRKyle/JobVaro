/**
 * ExpiryNoticeBanner — in-app warning banners shown at the top of every page.
 *
 * Two states (mutually exclusive in practice):
 *  1. Expiry notice (amber): a paid plan's expiry notice is due
 *     (7 / 5 / 3 / 1 days before expiry). The notice itself is server-fetched
 *     in the root layout loader and passed in as a prop. After first render
 *     the banner records the notice as delivered (client-side) so each
 *     threshold fires exactly once — dedup level is shared with the email
 *     sweep, whichever channel delivers first wins.
 *  2. Grace notice (rose): the paid plan has lapsed, the user is free, and
 *     over-limit data is locked during the 30-day grace period. Locked data
 *     is restored on renewal or permanently deleted when grace ends.
 */

import { useEffect, useState } from "react";
import {
  fillExpiryNoticeCopy,
  markExpiryNoticeSent,
  NOTICE_DAYS,
  type ExpiryNotice,
  type GraceNotice,
} from "~/services/plans";

function lockedCountCopy(apps: number, analyses: number): string {
  const parts: string[] = [];
  if (apps > 0) {
    parts.push(`${apps} application${apps === 1 ? "" : "s"}`);
  }
  if (analyses > 0) {
    parts.push(`${analyses} ${analyses === 1 ? "analysis" : "analyses"}`);
  }
  const joined =
    parts.length === 2 ? `${parts[0]} and ${parts[1]}` : (parts[0] ?? "0 items");
  const verb = (apps === 1 && analyses === 0) || (analyses === 1 && apps === 0)
    ? "is"
    : "are";
  return `${joined} beyond the free limits ${verb} locked`;
}

function GraceBanner({ grace }: { grace: GraceNotice }) {
  const deletionDate = new Date(grace.graceEndsAt as string).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <div
      role="alert"
      className="mx-auto mt-3 flex max-w-6xl flex-col gap-3 rounded-xl border border-rose-400/60 bg-rose-50 px-4 py-3 shadow-sm shadow-rose-500/10 sm:mx-6 sm:flex-row sm:items-center sm:px-6 dark:border-rose-500/50 dark:bg-rose-950/70"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/70 dark:text-rose-400">
          <svg
            className="h-4.5 w-4.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-relaxed text-rose-900 dark:text-rose-100">
            Your paid plan was a fixed-term purchase and did not renew
            automatically — access has ended.{" "}
            <span className="font-semibold">
              {lockedCountCopy(grace.lockedApplications, grace.lockedAnalyses)}
            </span>
            . Nothing is charged again; you must actively renew to restore
            everything within 30 days — otherwise they'll be permanently
            deleted on {deletionDate}.
          </p>
          <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-300">
            Actively renew before {deletionDate} to keep your data
          </p>
        </div>
      </div>
      <a
        href="/plans"
        className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-rose-500/40 transition hover:bg-rose-600 active:scale-[0.98] dark:bg-rose-500 dark:hover:bg-rose-400"
      >
        Renew now
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

export function ExpiryNoticeBanner({
  notice,
  grace,
}: {
  notice: ExpiryNotice | null;
  grace: GraceNotice | null;
}) {
  const [recorded, setRecorded] = useState(false);

  // Record the notice as delivered once, client-side, after first render.
  useEffect(() => {
    if (!notice || !notice.noticeDue || recorded) return;
    if (!(NOTICE_DAYS as readonly number[]).includes(notice.daysLeft)) return;
    markExpiryNoticeSent({ data: { level: notice.daysLeft } })
      .then(() => setRecorded(true))
      .catch(() => {
        /* non-fatal — the banner still shows; retry on next load */
      });
  }, [notice, recorded]);

  // Grace banner takes priority — a user whose plan lapsed is free, so the
  // expiry notice (paid only) is null anyway; this is defensive.
  if (grace?.inGrace && (grace.lockedApplications > 0 || grace.lockedAnalyses > 0)) {
    return <GraceBanner grace={grace} />;
  }

  if (!notice || !notice.noticeDue) return null;

  const expiryDate = new Date(notice.expiresAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      role="alert"
      className="mx-auto mt-3 flex max-w-6xl flex-col gap-3 rounded-xl border border-amber-400/60 bg-amber-50 px-4 py-3 shadow-sm shadow-amber-500/10 sm:mx-6 sm:flex-row sm:items-center sm:px-6 dark:border-amber-500/50 dark:bg-amber-950/70"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/70 dark:text-amber-400">
          <svg
            className="h-4.5 w-4.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-relaxed text-amber-900 dark:text-amber-100">
            {fillExpiryNoticeCopy(notice.planName, notice.daysLeft)}
          </p>
          <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            Your access ends on {expiryDate} · {notice.daysLeft}{" "}
            {notice.daysLeft === 1 ? "day" : "days"} remaining · will not renew
            automatically — renew to keep Pro
          </p>
        </div>
      </div>
      <a
        href="/plans"
        className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-amber-500/40 transition hover:bg-amber-600 active:scale-[0.98] dark:bg-amber-500 dark:hover:bg-amber-400"
      >
        Renew now
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

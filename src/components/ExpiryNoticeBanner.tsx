/**
 * ExpiryNoticeBanner — in-app amber warning shown when a paid plan's expiry
 * notice is due (7 / 5 / 3 / 1 days before expiry). Renders nothing for
 * logged-out users, free users, or paid plans without an expiry.
 *
 * The notice itself is server-fetched in the root layout loader and passed in
 * as a prop. After first render the banner records the notice as delivered
 * (client-side) so each threshold fires exactly once.
 */

import { useEffect, useState } from "react";
import {
  fillExpiryNoticeCopy,
  markExpiryNoticeSent,
  NOTICE_DAYS,
  type ExpiryNotice,
} from "~/services/plans";

export function ExpiryNoticeBanner({ notice }: { notice: ExpiryNotice | null }) {
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
            {notice.daysLeft === 1 ? "day" : "days"} remaining
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

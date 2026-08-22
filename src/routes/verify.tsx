import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { confirmEmail } from "~/auth/functions";

export const Route = createFileRoute("/verify")({
  component: VerifyPage,
});

function VerifyPage() {
  const search = Route.useSearch() as { token?: string };
  const token = typeof search.token === "string" ? search.token : "";

  const [state, setState] = useState<"pending" | "success" | "error">("pending");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setError("This verification link is invalid or has expired. Please sign up again to receive a new one.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await confirmEmail({ data: { token } });
        if (cancelled) return;
        if (result.success) {
          setState("success");
          // The server has created a session; a hard navigation re-renders the
          // app as logged in so the nav bar/greeting reflect the new session.
          window.setTimeout(() => {
            window.location.href = "/welcome";
          }, 1200);
        } else {
          setState("error");
          setError(result.error);
        }
      } catch {
        if (cancelled) return;
        setState("error");
        setError("Something went wrong. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-white dark:from-indigo-950/40 dark:via-gray-950 dark:to-gray-950" />
      <div className="relative w-full max-w-md">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-900/5 dark:border-gray-800 dark:bg-gray-900">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-100/60 blur-3xl dark:bg-violet-900/20" />
          <div className="relative">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
              Confirm your email
            </h1>

            {state === "pending" && (
              <div className="mt-6 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                Verifying your email…
              </div>
            )}

            {state === "success" && (
              <div className="mt-6">
                <div className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                  Your email is verified. Taking you to your dashboard…
                </div>
                <Link
                  to="/welcome"
                  className="mt-5 block rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:brightness-110 active:scale-[0.98]"
                >
                  Go to dashboard
                </Link>
              </div>
            )}

            {state === "error" && (
              <div className="mt-6">
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
                <Link
                  to="/track"
                  className="mt-5 block text-center text-sm font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Back to sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

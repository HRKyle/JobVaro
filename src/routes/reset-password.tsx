import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { resetPassword } from "~/auth/functions";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

const inputCls =
  "w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500";

function ResetPasswordPage() {
  const search = Route.useSearch() as { token?: string; email?: string };
  const token = typeof search.token === "string" ? search.token : "";
  const email = typeof search.email === "string" ? search.email : "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword({ data: { token, email, password } });
      if (result.success) {
        setDone(true);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const missingParams = !token || !email;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-white dark:from-indigo-950/40 dark:via-gray-950 dark:to-gray-950" />
      <div className="relative w-full max-w-md">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-900/5 dark:border-gray-800 dark:bg-gray-900">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-100/60 blur-3xl dark:bg-violet-900/20" />
          <div className="relative">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Choose a new password for your JobVaro account.
            </p>

            {done ? (
              <div className="mt-6">
                <div className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                  Your password has been reset. You can now sign in with your new
                  password.
                </div>
                <Link
                  to="/track"
                  className="mt-5 block rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:brightness-110 active:scale-[0.98]"
                >
                  Sign in
                </Link>
              </div>
            ) : missingParams ? (
              <div className="mt-6">
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  This reset link is invalid or has expired. Please request a new
                  one.
                </div>
                <Link
                  to="/forgot-password"
                  className="mt-5 block text-center text-sm font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Request a new link
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="reset-password"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <svg
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <input
                      id="reset-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className={inputCls}
                      placeholder="At least 8 characters"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="reset-confirm"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Confirm new password
                  </label>
                  <div className="relative">
                    <svg
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.62-1.62A9 9 0 1112 3a9 9 0 015.62 1.62z"
                      />
                    </svg>
                    <input
                      id="reset-confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className={inputCls}
                      placeholder="Re-enter your password"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:shadow-indigo-500/35 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {loading ? "Resetting…" : "Reset password"}
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <Link
                to="/track"
                className="font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

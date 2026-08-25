import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getCurrentUser, getSessionToken, type AuthUser } from "~/auth/functions";
import { AuthForms } from "~/components/AuthForms";

// ── Route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/extension")({
  loader: async () => {
    const [userResult, tokenResult] = await Promise.all([
      getCurrentUser(),
      getSessionToken(),
    ]);
    return { user: userResult.user, token: tokenResult.token };
  },
  component: ExtensionPage,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────
function ExtensionPage() {
  const { user: initialUser, token: initialToken } = Route.useLoaderData();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(initialUser);
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);

  // Refresh user state if it changes on the client (e.g. after sign-in elsewhere)
  useEffect(() => {
    setCurrentUser(initialUser);
  }, [initialUser]);

  // If a user signs in on this page (inline AuthForms), re-fetch the token.
  useEffect(() => {
    if (currentUser && !token) {
      getSessionToken().then((r) => setToken(r.token ?? null));
    }
  }, [currentUser, token]);

  const handleCopy = async () => {
    if (!token) return;
    const ok = await copyText(token);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // ── Sign-in gate ────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Sign in to set up the extension
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              You&apos;ll need to be signed in to copy your extension token.
            </p>
          </div>
          <AuthForms onAuthSuccess={(u) => setCurrentUser(u)} />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v4a1 1 0 001 1h4" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
          </svg>
          Browser Extension
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Connect the JobVaro extension
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Save any job listing to your tracker with one click — no copying URLs by hand.
        </p>
      </div>

      {/* Security warning */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
        <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">Treat this token like a password.</p>
          <p className="mt-1">
            Anyone with this token can access your signed-in JobVaro account and save
            jobs as you. Only paste it into the official JobVaro Chrome extension. Never
            share it, post it, or paste it anywhere else.
          </p>
        </div>
      </div>

      {/* Token card */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Your session token</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Copy this, then paste it into the extension&apos;s popup.
          </p>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            {token ?? "…"}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!token}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-95 disabled:opacity-50 ${
              copied
                ? "bg-green-600"
                : "bg-gradient-to-r from-indigo-600 to-violet-500 shadow-indigo-500/25 hover:shadow-lg hover:brightness-110"
            }`}
          >
            {copied ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy token
              </>
            )}
          </button>
        </div>
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
          This token is tied to your current sign-in and is read-only — you can&apos;t
          regenerate it from here. Sign out and back in to your account to get a fresh
          token.
        </div>
      </div>

      {/* Setup steps */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-5 text-base font-bold text-gray-900 dark:text-gray-100">
          How to set it up
        </h2>
        <ol className="space-y-5">
          {[
            {
              title: "Install the extension",
              body: "Add the JobVaro “Save Job” extension from the Chrome Web Store (listed under HRKyle Services).",
            },
            {
              title: "Copy your token",
              body: "Tap “Copy token” above to copy your session token to the clipboard.",
            },
            {
              title: "Open the extension & paste the token",
              body: "Click the extension icon in your browser toolbar, then paste the token into the “Paste session token here” field and hit Save.",
            },
            {
              title: "Save any job",
              body: "Browse Indeed, LinkedIn, Glassdoor, or any company site — click the extension icon and it saves the job straight to your tracker.",
            },
          ].map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-500 text-sm font-bold text-white shadow-sm shadow-indigo-500/25">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{step.title}</p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

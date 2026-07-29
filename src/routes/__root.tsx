import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { getCurrentUser, logout, type AuthUser } from "~/auth/functions";

import appCss from "~/styles/app.css?url";

// Server function to read business name
const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "JobVaro";
  } catch {
    return "JobVaro";
  }
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "JobVaro — Find your next role" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  loader: async () => {
    const [businessName, userResult] = await Promise.all([
      getBusinessName(),
      getCurrentUser(),
    ]);
    return { businessName, user: userResult.user };
  },
  component: RootComponent,
});

function RootComponent() {
  const { businessName, user: initialUser } = Route.useLoaderData();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync user state from loader (for client-side updates after auth)
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const handleLogout = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  return (
    <RootDocument>
      {/* Navigation bar */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100"
          >
            <svg className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {businessName}
          </a>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-6 md:flex">
            <a
              href="/search"
              className="text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Search
            </a>
            <a
              href="/community"
              className="text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Community
            </a>
            <a
              href="/companies"
              className="text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Companies
            </a>
            <a
              href="/track"
              className="text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Track
            </a>
            <a
              href="/plans"
              className="text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Plans
            </a>

            {/* User menu */}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {user.name ?? user.email}
                </span>
                {user.is_admin && (
                  <a
                    href="/admin"
                    className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900"
                  >
                    Admin
                  </a>
                )}
                {user.plan !== "pro" && (
                  <a
                    href="/plans"
                    className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-400 dark:hover:bg-indigo-900"
                  >
                    Upgrade
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  Log out
                </button>
              </div>
            ) : (
              <a
                href="/"
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                Sign in
              </a>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 px-4 py-3 md:hidden dark:border-gray-800">
            <div className="flex flex-col gap-3">
              <a
                href="/search"
                className="text-sm font-medium text-gray-600 dark:text-gray-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                Search
              </a>
              <a
                href="/community"
                className="text-sm font-medium text-gray-600 dark:text-gray-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                Community
              </a>
              <a
                href="/companies"
                className="text-sm font-medium text-gray-600 dark:text-gray-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                Companies
              </a>
              <a
                href="/track"
                className="text-sm font-medium text-gray-600 dark:text-gray-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                Track
              </a>
              <a
                href="/plans"
                className="text-sm font-medium text-gray-600 dark:text-gray-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                Plans
              </a>
              {user ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-500">
                      {user.name ?? user.email}
                    </span>
                    {user.is_admin && (
                      <a
                        href="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="rounded-lg bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                      >
                        Admin
                      </a>
                    )}
                    {user.plan !== "pro" && (
                      <a
                        href="/plans"
                        onClick={() => setMobileMenuOpen(false)}
                        className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                      >
                        Upgrade
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-400"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <a
                  href="/"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign in
                </a>
              )}
            </div>
          </div>
        )}
      </nav>

      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

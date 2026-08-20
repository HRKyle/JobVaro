import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { getCurrentUser, logout, type AuthUser } from "~/auth/functions";
import { Logo } from "~/components/Logo";
import { Footer } from "~/components/Footer";
import { Toaster } from "~/components/toast";
import { ExpiryNoticeBanner } from "~/components/ExpiryNoticeBanner";
import { getExpiryNotice, getGraceStatus } from "~/services/plans";

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
    const [businessName, userResult, expiryNotice, graceStatus] = await Promise.all([
      getBusinessName(),
      getCurrentUser(),
      getExpiryNotice(),
      getGraceStatus(),
    ]);
    return { businessName, user: userResult.user, expiryNotice, graceStatus };
  },
  component: RootComponent,
});

const NAV_LINKS: { href: string; label: string; badge?: string }[] = [
  { href: "/search", label: "Search" },
  { href: "/community", label: "Community" },
  { href: "/companies", label: "Companies" },
  { href: "/compass", label: "Compass", badge: "New" },
  { href: "/track", label: "Track" },
];

function NavLink({
  href,
  label,
  badge,
  active,
  onNavigate,
  mobile = false,
}: {
  href: string;
  label: string;
  badge?: string;
  active: boolean;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  return (
    <a
      href={href}
      onClick={onNavigate}
      className={
        mobile
          ? `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`
          : `group relative inline-flex items-center gap-1.5 py-1 text-sm font-medium transition ${
              active
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`
      }
    >
      {label}
      {badge && (
        <span className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          {badge}
        </span>
      )}
      {/* Active underline indicator (desktop) */}
      {!mobile && (
        <span
          className={`absolute -bottom-0.5 left-0 h-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-300 ${
            active ? "w-full opacity-100" : "w-0 opacity-0 group-hover:w-full group-hover:opacity-40"
          }`}
        />
      )}
    </a>
  );
}

function UserMenu({
  user,
  onLogout,
  onNavigate,
}: {
  user: AuthUser;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initial = (user.name ?? user.email ?? "U").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-2.5 transition hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:hover:border-gray-600"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-500 text-xs font-bold text-white">
          {initial}
        </span>
        <span className="hidden max-w-28 truncate text-xs font-medium text-gray-700 sm:block dark:text-gray-300">
          {user.name ?? user.email}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-in absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:shadow-black/40"
        >
          <div className="border-b border-gray-100 px-4 py-2.5 dark:border-gray-700">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {user.name ?? "Account"}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
          {user.is_admin && (
            <a
              href="/admin"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/60"
            >
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Admin
            </a>
          )}
          {user.plan !== "pro" && (
            <a
              href="/plans"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/60"
            >
              <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Upgrade to Pro
            </a>
          )}
          <a
            href="/track"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            role="menuitem"
            className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/60"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            My Applications
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function RootComponent() {
  const { businessName, user: initialUser, expiryNotice, graceStatus } = Route.useLoaderData();
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync user state from loader (for client-side updates after auth)
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  const pathname = location.pathname;
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <RootDocument>
      <div className="flex min-h-dvh flex-col">
        {/* Navigation bar */}
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <a href="/" aria-label="JobVaro home">
              <div className="flex items-center gap-2">
                <Logo name={businessName} />
                <span className="text-[10px] font-medium text-gray-400 sm:inline">by HRKyle</span>
              </div>
            </a>

            {/* Desktop nav links */}
            <div className="hidden items-center gap-6 md:flex">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  badge={link.badge}
                  active={isActive(link.href)}
                />
              ))}
            </div>

            {/* User area (desktop) */}
            <div className="hidden items-center gap-3 md:flex">
              {user ? (
                <UserMenu user={user} onLogout={handleLogout} />
              ) : (
                <a
                  href="/track"
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/30 transition hover:from-indigo-700 hover:to-violet-600 hover:shadow-md hover:shadow-indigo-500/40 active:scale-95"
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
              aria-label="Toggle menu"
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

          {/* Mobile menu — slide-in panel with backdrop blur */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div
                className="animate-fade-in absolute inset-0 bg-gray-950/50 backdrop-blur-sm"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="animate-slide-in-right absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-l border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <Logo name={businessName} />
                    <span className="text-[10px] font-medium text-gray-400">by HRKyle</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    aria-label="Close menu"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex flex-col gap-1 p-3">
                  {NAV_LINKS.map((link) => (
                    <NavLink
                      key={link.href}
                      href={link.href}
                      label={link.label}
                      badge={link.badge}
                      active={isActive(link.href)}
                      mobile
                      onNavigate={() => setMobileMenuOpen(false)}
                    />
                  ))}
                </div>
                <div className="mt-auto border-t border-gray-100 p-4 dark:border-gray-800">
                  {user ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-500 text-sm font-bold text-white">
                          {(user.name ?? user.email ?? "U").charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {user.name ?? "Account"}
                          </p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {user.is_admin && (
                          <a
                            href="/admin"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex-1 rounded-lg bg-amber-100 px-3 py-2 text-center text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                          >
                            Admin
                          </a>
                        )}
                        {user.plan !== "pro" && (
                          <a
                            href="/plans"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-3 py-2 text-center text-xs font-semibold text-white"
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
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        Log out
                      </button>
                    </div>
                  ) : (
                    <a
                      href="/track"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-indigo-500/30"
                    >
                      Sign in
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* In-app expiry/grace notice banners — render nothing for logged-out/free users */}
        <ExpiryNoticeBanner notice={expiryNotice} grace={graceStatus} />

        {/* Page content with fade-in transition on route change */}
        <div
          key={mounted ? pathname : "boot"}
          className="animate-page-fade flex-1"
        >
          <Outlet />
        </div>

        <Footer brandName={businessName} />
      </div>
      <Toaster />
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

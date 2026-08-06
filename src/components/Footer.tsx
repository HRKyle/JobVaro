import { Logo } from "~/components/Logo";

const FOOTER_LINKS: { href: string; label: string }[] = [
  { href: "/search", label: "Search" },
  { href: "/community", label: "Community" },
  { href: "/companies", label: "Companies" },
  { href: "/compass", label: "Compass" },
  { href: "/track", label: "Track" },
  { href: "/plans", label: "Plans" },
];

export function Footer({ brandName = "JobVaro" }: { brandName?: string }) {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white px-6 py-10 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <a href="/" aria-label="JobVaro home">
          <Logo name={brandName} />
        </a>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
          {FOOTER_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition hover:text-gray-900 dark:hover:text-gray-200"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-8 flex max-w-6xl items-center justify-center gap-3 border-t border-gray-100 pt-6 text-center text-sm text-gray-400 dark:border-gray-800 dark:text-gray-600">
        <span>Part of HRKyle Services</span>
        <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        <span>Your Guide Through the World of Work™</span>
        <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        <span>© {new Date().getFullYear()} {brandName}</span>
        <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        <span>Built for job seekers, by job seekers</span>
      </div>
    </footer>
  );
}

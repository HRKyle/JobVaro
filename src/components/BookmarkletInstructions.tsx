import { useState, useRef, useEffect, useCallback } from "react";

// ── Bookmarklet JS ───────────────────────────────────────────────────────────
export const BOOKMARKLET_JS =
  `javascript:(function(){var title=document.title.replace(/\\s*[-|]\\s*.*$/,'').trim();var company='';var m=document.querySelector('meta[property="og:site_name"]');if(m) company=m.getAttribute('content');if(!company) company=location.hostname.replace('www.','').replace('.com','').replace('.io','');company=company.charAt(0).toUpperCase()+company.slice(1);var url=location.href;location.href='https://b705ed824dd0f2d1ccaf36868664c133.ctonew.app/track?url='+encodeURIComponent(url)+'&title='+encodeURIComponent(title)+'&company='+encodeURIComponent(company);})();`;

// ── Browser instructions ─────────────────────────────────────────────────────
interface BrowserInfo {
  name: string;
  icon: string;
  menuPath: string;
  shortcut: string;
}

const BROWSERS: BrowserInfo[] = [
  {
    name: "Chrome",
    icon: "🌐",
    menuPath: '⋮ menu → Bookmarks → "Show bookmarks bar"',
    shortcut: "Ctrl+Shift+B",
  },
  {
    name: "Firefox",
    icon: "🦊",
    menuPath:
      'Right-click top of browser → "Bookmarks Toolbar" → "Always Show"',
    shortcut: "Ctrl+Shift+B",
  },
  {
    name: "Safari",
    icon: "🧭",
    menuPath: 'View menu → "Show Favorites Bar"',
    shortcut: "⌘⇧B",
  },
  {
    name: "Edge",
    icon: "🟦",
    menuPath: '⋯ menu → Favorites → "Show favorites bar"',
    shortcut: "Ctrl+Shift+B",
  },
];

// ── Scroll fade-in hook ──────────────────────────────────────────────────────
function useScrollFade(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }

    setVisible(false);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, mounted]);

  return { ref, visible };
}

function FadeWrap({
  children,
  animated,
  className = "",
  threshold,
}: {
  children: React.ReactNode;
  animated: boolean;
  className?: string;
  threshold?: number;
}) {
  const { ref, visible } = useScrollFade(threshold);
  if (!animated) return <>{children}</>;
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ── Browser mockup for Step 2 ────────────────────────────────────────────────
function BrowserMockup() {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-gray-300 bg-white shadow-md dark:border-gray-700 dark:bg-gray-900">
      {/* Address bar */}
      <div className="flex items-center gap-2 bg-gray-100 px-4 py-2.5 dark:bg-gray-800">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className="ml-2 flex-1 rounded-md bg-white px-3 py-1.5 text-xs text-gray-400 dark:bg-gray-700 dark:text-gray-500">
          🔍 https://example.com/jobs/...
        </div>
      </div>

      {/* Label: Address Bar */}
      <div className="border-b border-gray-200 px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:border-gray-700 dark:text-gray-500">
        Address Bar
      </div>

      {/* Bookmarks bar */}
      <div className="relative flex items-center gap-3 bg-indigo-50 px-4 py-3 dark:bg-indigo-950/50">
        <span className="text-xs text-gray-500 dark:text-gray-400">📁</span>
        <div className="flex items-center gap-2 rounded-md bg-indigo-100 px-3 py-1.5 dark:bg-indigo-900/50">
          <span className="text-sm">📌</span>
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            Save to JobVaro
          </span>
        </div>
        {/* Drop arrow indicator */}
        <div className="absolute -top-5 right-12 flex flex-col items-center">
          <span className="text-sm leading-none">↓</span>
          <span className="whitespace-nowrap rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
            Drop here
          </span>
        </div>
      </div>

      {/* Label: Bookmarks Bar */}
      <div className="border-b border-gray-200 bg-indigo-50 px-4 py-1 text-[10px] font-medium uppercase tracking-wider text-indigo-500 dark:border-gray-700 dark:bg-indigo-950/50 dark:text-indigo-300">
        Bookmarks Bar
      </div>

      {/* Web page area */}
      <div className="flex items-center justify-center bg-white px-4 py-8 dark:bg-gray-900">
        <span className="text-sm text-gray-400 dark:text-gray-600">
          Web Page
        </span>
      </div>
    </div>
  );
}

// ── Draggable button ─────────────────────────────────────────────────────────
function BookmarkletButton() {
  return (
    <a
      href={BOOKMARKLET_JS}
      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 hover:shadow-xl cursor-grab active:cursor-grabbing"
      onClick={(e) => {
        e.preventDefault();
        alert("Drag this button to your bookmarks bar!");
      }}
      title="Drag to your bookmarks bar"
    >
      📌 Save to JobVaro
    </a>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function BookmarkletInstructions({
  animated = false,
}: {
  animated?: boolean;
}) {
  const [selectedBrowser, setSelectedBrowser] = useState("Chrome");

  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <FadeWrap animated={animated}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            📌 No install required
          </span>
          <h2 className="mt-4 text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
            Save Jobs From Anywhere
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-gray-600 dark:text-gray-400">
            Add our one-click bookmarklet to your browser and save job listings
            straight to your tracker — no installation needed.
          </p>
        </FadeWrap>

        {/* ── Step 1: Show bookmarks bar ─────────────────────────────────── */}
        <FadeWrap animated={animated} threshold={0.1}>
          <div className="mt-10">
            {/* Mobile message */}
            <div className="block md:hidden rounded-xl border-2 border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-800 dark:bg-amber-950/30">
              <span className="text-2xl">🖥️</span>
              <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                The bookmarklet works on desktop browsers.
              </p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Visit this page on your laptop or desktop computer to set it up.
              </p>
            </div>

            {/* Desktop instructions */}
            <div className="hidden md:block">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                  1
                </span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Show your bookmarks bar
                </h3>
              </div>

              {/* Browser tabs */}
              <div className="mb-4 flex flex-wrap gap-1.5">
                {BROWSERS.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => setSelectedBrowser(b.name)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                      selectedBrowser === b.name
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    }`}
                  >
                    {b.icon} {b.name}
                  </button>
                ))}
              </div>

              {/* Selected browser card */}
              {BROWSERS.filter((b) => b.name === selectedBrowser).map((b) => (
                <div
                  key={b.name}
                  className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{b.icon}</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {b.name}
                      </p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {b.menuPath}
                      </p>
                      <kbd className="mt-2 inline-block rounded border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs font-mono text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {b.shortcut}
                      </kbd>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeWrap>

        {/* ── Step 2: Drag button ──────────────────────────────────────── */}
        <FadeWrap animated={animated} threshold={0.1}>
          <div className="mt-10 hidden md:block">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                2
              </span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Drag this button to your bookmarks bar
              </h3>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: draggable button + instructions */}
              <div className="flex flex-col items-center justify-center gap-4">
                <BookmarkletButton />
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Click and drag this button up to the bar that just appeared at
                  the top of your browser
                </p>
                <svg
                  className="mt-1 h-6 w-6 animate-bounce text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              </div>

              {/* Right: browser mockup */}
              <div>
                <BrowserMockup />
              </div>
            </div>
          </div>
        </FadeWrap>

        {/* ── Step 3: Click it on any job page ────────────────────────── */}
        <FadeWrap animated={animated} threshold={0.1}>
          <div className="mt-10 hidden md:block">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                3
              </span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Click it on any job page
              </h3>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 text-green-500">✅</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Browse a job listing on{" "}
                    <strong>Indeed, LinkedIn, Glassdoor</strong>, or any company
                    careers site
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 text-green-500">✅</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Click the <strong>"Save to JobVaro"</strong> bookmark — it
                    opens your tracker with all details pre-filled
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 text-green-500">✅</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    That's it! The job details will be pre-filled — just click Save to add it to your tracker
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </FadeWrap>

        {/* ── Bonus: Fallback ─────────────────────────────────────────── */}
        <FadeWrap animated={animated} threshold={0.1}>
          <div className="mt-10 hidden md:block">
            <details className="group rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
                <svg
                  className="h-4 w-4 transition-transform group-open:rotate-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Can't get it to work?
              </summary>
              <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
                <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      1
                    </span>
                    <span>
                      <strong>Right-click</strong> the "Save to JobVaro" button
                      above →{" "}
                      <strong>Copy Link Address</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      2
                    </span>
                    <span>
                      Create a <strong>new bookmark</strong> in your browser and
                      paste the link as the URL
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      3
                    </span>
                    <span>
                      Name it <strong>"Save to JobVaro"</strong> and save it to
                      your bookmarks bar
                    </span>
                  </li>
                </ol>
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  Need more help? The bookmarklet works on all modern browsers.
                </p>
              </div>
            </details>
          </div>
        </FadeWrap>
      </div>
    </section>
  );
}

// ── Compact variant for inline use (track page sidebar-style) ────────────────
export function BookmarkletInstructionsCompact() {
  const [selectedBrowser, setSelectedBrowser] = useState("Chrome");

  return (
    <section className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 p-6 dark:border-indigo-900 dark:bg-indigo-950/30">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📌</span>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Save Jobs From Anywhere
        </h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Add our bookmarklet to save jobs from any site with one click. No
        installation needed.
      </p>

      {/* Mobile message */}
      <div className="block md:hidden mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950/30">
        <span className="text-xl">🖥️</span>
        <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
          The bookmarklet works on desktop browsers. Visit this page on your
          laptop or desktop to set it up.
        </p>
      </div>

      {/* Desktop steps */}
      <div className="hidden md:block">
        {/* Step 1: Tabs */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
              1
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Show your bookmarks bar
            </span>
          </div>

          {/* Browser tabs */}
          <div className="flex flex-wrap gap-1 mb-3">
            {BROWSERS.map((b) => (
              <button
                key={b.name}
                type="button"
                onClick={() => setSelectedBrowser(b.name)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  selectedBrowser === b.name
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                {b.icon} {b.name}
              </button>
            ))}
          </div>

          {/* Selected browser info */}
          {BROWSERS.filter((b) => b.name === selectedBrowser).map((b) => (
            <div
              key={b.name}
              className="rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800"
            >
              <p className="text-gray-700 dark:text-gray-300">{b.menuPath}</p>
              <kbd className="mt-1.5 inline-block rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400">
                {b.shortcut}
              </kbd>
            </div>
          ))}
        </div>

        {/* Step 2: Drag */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
              2
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Drag button to bookmarks bar
            </span>
          </div>

          <div className="flex items-center gap-4">
            <BookmarkletButton />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ← Drag up to your bookmarks bar
            </span>
          </div>
        </div>

        {/* Step 3: Use */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
              3
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Click it on any job page
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Browse Indeed, LinkedIn, Glassdoor, or any company site → click the
            bookmark → details pre-filled, just click Save!
          </p>
        </div>

        {/* Fallback */}
        <details className="group mt-2 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg
              className="h-3 w-3 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            Can't get it to work?
          </summary>
          <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Right-click the button → Copy Link Address → create a new bookmark
              with that link.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}

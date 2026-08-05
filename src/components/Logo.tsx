export function Logo({
  name = "JobVaro",
  className = "h-7 w-7",
  textClassName = "text-lg",
}: {
  name?: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="relative inline-flex">
        <svg
          className={`${className} text-indigo-600 dark:text-indigo-400`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <defs>
            <linearGradient id="jv-logo-grad" x1="0" y1="0" x2="24" y2="24">
              <stop stopColor="#4F46E5" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            stroke="url(#jv-logo-grad)"
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </span>
      <span
        className={`${textClassName} font-bold tracking-tight text-gray-900 dark:text-white`}
      >
        {name}
      </span>
    </span>
  );
}

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let pushToast: ((message: string, type?: ToastType) => void) | null = null;

/** Fire a toast from anywhere in the app (client-side only). */
export function toast(message: string, type: ToastType = "success") {
  pushToast?.(message, type);
}

const TYPE_STYLES: Record<
  ToastType,
  { bar: string; icon: string; iconPath: string }
> = {
  success: {
    bar: "bg-green-500",
    icon: "text-green-500",
    iconPath:
      "M5 13l4 4L19 7",
  },
  error: {
    bar: "bg-red-500",
    icon: "text-red-500",
    iconPath: "M6 18L18 6M6 6l12 12",
  },
  info: {
    bar: "bg-indigo-500",
    icon: "text-indigo-500",
    iconPath: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let id = 0;
    pushToast = (message, type = "success") => {
      const toastId = ++id;
      setItems((prev) => [...prev.slice(-3), { id: toastId, message, type }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== toastId));
      }, 3500);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[calc(100vw-2.5rem)] max-w-sm flex-col gap-2"
    >
      {items.map((t) => {
        const s = TYPE_STYLES[t.type];
        return (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-4 shadow-lg shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:shadow-black/40"
          >
            <span
              className={`absolute inset-y-0 left-0 w-1 ${s.bar}`}
              aria-hidden
            />
            <svg
              className={`mt-0.5 h-5 w-5 flex-shrink-0 ${s.icon}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={s.iconPath} />
            </svg>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {t.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}

import type { ApplicationStatus } from "~/services/applications";

const STATUS_STYLES: Record<
  ApplicationStatus,
  { bg: string; text: string; label: string }
> = {
  saved: {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-700 dark:text-gray-300",
    label: "Saved",
  },
  applied: {
    bg: "bg-blue-100 dark:bg-blue-950",
    text: "text-blue-700 dark:text-blue-300",
    label: "Applied",
  },
  phone_screen: {
    bg: "bg-violet-100 dark:bg-violet-950",
    text: "text-violet-700 dark:text-violet-300",
    label: "Phone Screen",
  },
  interview: {
    bg: "bg-purple-100 dark:bg-purple-950",
    text: "text-purple-700 dark:text-purple-300",
    label: "Interview",
  },
  technical: {
    bg: "bg-indigo-100 dark:bg-indigo-950",
    text: "text-indigo-700 dark:text-indigo-300",
    label: "Technical",
  },
  offer: {
    bg: "bg-green-100 dark:bg-green-950",
    text: "text-green-700 dark:text-green-300",
    label: "Offer",
  },
  accepted: {
    bg: "bg-emerald-100 dark:bg-emerald-950",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "Accepted",
  },
  rejected: {
    bg: "bg-red-100 dark:bg-red-950",
    text: "text-red-700 dark:text-red-300",
    label: "Rejected",
  },
  withdrawn: {
    bg: "bg-orange-100 dark:bg-orange-950",
    text: "text-orange-700 dark:text-orange-300",
    label: "Withdrawn",
  },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.applied;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function statusLabel(status: ApplicationStatus): string {
  return STATUS_STYLES[status]?.label ?? status;
}

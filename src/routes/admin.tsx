import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "~/auth/functions";
import { sql } from "~/db";

// ── Server functions for admin data ─────────────────────────────────────────

interface AdminStats {
  totalUsers: number;
  totalApplications: number;
  totalSavedJobs: number;
  recentUsers: Array<{
    id: string;
    email: string;
    name: string | null;
    created_at: string;
    plan: string;
  }>;
}

const getAdminStats = createServerFn({ method: "GET" }).handler(async (): Promise<AdminStats> => {
  const [usersRow] = await sql`SELECT COUNT(*)::int AS count FROM users`;
  const [appsRow] = await sql`SELECT COUNT(*)::int AS count FROM applications`;
  const [jobsRow] = await sql`SELECT COUNT(*)::int AS count FROM saved_jobs`;
  const recent = await sql`
    SELECT id, email, name, created_at, plan
    FROM users
    ORDER BY created_at DESC
    LIMIT 10
  `;

  return {
    totalUsers: (usersRow as { count: number }).count,
    totalApplications: (appsRow as { count: number }).count,
    totalSavedJobs: (jobsRow as { count: number }).count,
    recentUsers: recent as AdminStats["recentUsers"],
  };
});

// ── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin")({
  loader: async () => {
    const { user } = await getCurrentUser();
    if (!user || !user.is_admin) {
      throw redirect({ to: "/" });
    }
    const stats = await getAdminStats();
    return { user, stats };
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const { stats } = Route.useLoaderData();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of your JobVaro platform
        </p>
      </div>

      {/* Stats cards */}
      <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          color="indigo"
        />
        <StatCard
          label="Applications"
          value={stats.totalApplications}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          color="green"
        />
        <StatCard
          label="Saved Jobs"
          value={stats.totalSavedJobs}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          }
          color="amber"
        />
      </div>

      {/* Recent signups */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Recent Signups
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Plan</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.recentUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                    {u.name ?? <span className="italic text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.plan === "pro"
                          ? "inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }
                    >
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-500">
                    {new Date(u.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
              {stats.recentUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

// ── Stat card component ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "indigo" | "green" | "amber";
}) {
  const colorMap = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${colorMap[color]}`}>{icon}</div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

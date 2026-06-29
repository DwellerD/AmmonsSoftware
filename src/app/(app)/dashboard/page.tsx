"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorAlert, LoadingState } from "@/components/ui/States";
import { useAuth } from "@/components/providers/AuthProvider";
import { listRecentActivity, listTradePhases } from "@/lib/api";
import { todayIso, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  ActivityLog,
  TradePhaseWithRelations,
} from "@/lib/database.types";

/**
 * GC daily dashboard — the morning overview.
 *
 * Summarizes the day's important numbers (active work, today's schedule,
 * blockers, inspections) and shows recently updated phases plus a recent
 * activity feed. All numbers are computed from real Firestore data.
 */
export default function DashboardPage() {
  const { email } = useAuth();
  const [phases, setPhases] = useState<TradePhaseWithRelations[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [ph, act] = await Promise.all([
          listTradePhases(),
          listRecentActivity(8),
        ]);
        setPhases(ph);
        setActivity(act);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Derive the dashboard numbers from the loaded phases.
  const stats = useMemo(() => {
    const today = todayIso();

    const isScheduledToday = (p: TradePhaseWithRelations) => {
      if (!p.scheduled_start_date) return false;
      if (p.scheduled_end_date) {
        return p.scheduled_start_date <= today && today <= p.scheduled_end_date;
      }
      return p.scheduled_start_date === today;
    };

    return {
      active: phases.filter((p) => p.status !== "Approved").length,
      today: phases.filter(isScheduledToday).length,
      blocked: phases.filter((p) => p.status === "Blocked").length,
      inspection: phases.filter((p) => p.status === "Needs Inspection").length,
    };
  }, [phases]);

  // Most recently updated phases (top 5).
  const recentlyUpdated = useMemo(
    () =>
      [...phases]
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
        .slice(0, 5),
    [phases],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={email ? `Welcome back, ${email}` : "Your daily overview"}
      />

      {loading ? (
        <LoadingState message="Loading dashboard…" />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active trade phases"
              value={stats.active}
              accent="text-brand-600"
            />
            <StatCard
              label="Scheduled today"
              value={stats.today}
              accent="text-indigo-600"
            />
            <StatCard
              label="Blocked"
              value={stats.blocked}
              accent="text-red-600"
            />
            <StatCard
              label="Needs inspection"
              value={stats.inspection}
              accent="text-orange-600"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recently updated phases */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Recently updated</CardTitle>
                <Link
                  href="/trade-phases"
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  View all
                </Link>
              </CardHeader>
              <CardBody className="p-0">
                {recentlyUpdated.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-ink-500">
                    No trade phases yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {recentlyUpdated.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/trade-phases/${p.id}`}
                          className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">
                              {p.title}
                            </p>
                            <p className="text-xs text-ink-500">
                              {p.project?.name ?? "—"} · updated{" "}
                              {timeAgo(p.updated_at)}
                            </p>
                          </div>
                          <StatusBadge status={p.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            {/* Recent activity feed */}
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                {activity.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-ink-500">
                    Activity will appear here as you work.
                  </p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {activity.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-start gap-3 px-5 py-3"
                      >
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />
                        <div className="min-w-0">
                          <p className="text-sm text-ink-800">
                            {a.description}
                          </p>
                          <p className="text-xs text-ink-400">
                            {timeAgo(a.created_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

/** A single headline number on the dashboard. */
function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-ink-500">{label}</p>
        <p className={cn("mt-1 text-3xl font-bold", accent)}>{value}</p>
      </CardBody>
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorAlert, LoadingState } from "@/components/ui/States";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  listAllPunchItems,
  listDocuments,
  listMaterialOrders,
  listNotifications,
  listRecentActivity,
  listTradePhases,
} from "@/lib/api";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_STYLES,
} from "@/lib/constants";
import { todayIso, timeAgo, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  ActivityLog,
  MaterialOrder,
  Notification,
  ProjectDocument,
  PunchItem,
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
  const [materials, setMaterials] = useState<MaterialOrder[]>([]);
  const [punch, setPunch] = useState<PunchItem[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [ph, act, mats, pun, docs, notes] = await Promise.all([
          listTradePhases(),
          listRecentActivity(8),
          listMaterialOrders(),
          listAllPunchItems(),
          listDocuments(),
          listNotifications(),
        ]);
        setPhases(ph);
        setActivity(act);
        setMaterials(mats);
        setPunch(pun);
        setDocuments(docs);
        setNotifications(notes);
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

  // Sprint 2 attention lists, all derived from real Firestore data.
  const sprint2 = useMemo(() => {
    const today = todayIso();
    const isActivePunch = (p: PunchItem) =>
      p.status !== "Resolved" && p.status !== "Closed";
    return {
      arrivingToday: materials.filter(
        (m) =>
          m.expected_arrival_date === today &&
          m.status !== "Received" &&
          m.status !== "Cancelled",
      ),
      delayedMaterials: materials.filter((m) => m.status === "Delayed"),
      submittedForReview: phases.filter(
        (p) => p.status === "Submitted Complete",
      ),
      needsInspection: phases.filter((p) => p.status === "Needs Inspection"),
      openPunch: punch.filter(isActivePunch),
      overduePunch: punch.filter(
        (p) => isActivePunch(p) && p.due_date != null && p.due_date < today,
      ),
    };
  }, [materials, phases, punch]);

  // Sprint 3 attention lists (documents, contractor confirmations, updates).
  const sprint3 = useMemo(() => {
    const pinned = documents.filter((d) => d.pinned);
    const recentDocs = [...documents]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 5);
    const isActivePunch = (p: PunchItem) =>
      p.status !== "Resolved" && p.status !== "Closed";
    return {
      pinnedDocuments: pinned,
      recentDocuments: recentDocs,
      pendingConfirmations: phases.filter(
        (p) => p.schedule_confirmation_status === "Pending",
      ),
      declinedConfirmations: phases.filter(
        (p) => p.schedule_confirmation_status === "Declined",
      ),
      contractorPunchUpdates: punch.filter(
        (p) => p.contractor_notes != null && isActivePunch(p),
      ),
      recentNotifications: [...notifications]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 5),
    };
  }, [documents, notifications, phases, punch]);

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

          {/* Sprint 2 attention sections */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AttentionCard
              title="Materials arriving today"
              count={sprint2.arrivingToday.length}
              href="/material-orders"
              emptyText="Nothing scheduled to arrive today."
              items={sprint2.arrivingToday.map((m) => ({
                key: m.id,
                primary: m.name,
                secondary: m.supplier ?? "No supplier",
              }))}
            />
            <AttentionCard
              title="Delayed materials"
              count={sprint2.delayedMaterials.length}
              href="/material-orders"
              accent="amber"
              emptyText="No delayed materials."
              items={sprint2.delayedMaterials.map((m) => ({
                key: m.id,
                primary: m.name,
                secondary: m.expected_arrival_date
                  ? `Expected ${formatDate(m.expected_arrival_date)}`
                  : (m.supplier ?? "No supplier"),
              }))}
            />
            <AttentionCard
              title="Submitted for review"
              count={sprint2.submittedForReview.length}
              href="/trade-phases"
              emptyText="No completions waiting on review."
              items={sprint2.submittedForReview.map((p) => ({
                key: p.id,
                href: `/trade-phases/${p.id}`,
                primary: p.title,
                secondary: p.project?.name ?? "\u2014",
              }))}
            />
            <AttentionCard
              title="Needs inspection"
              count={sprint2.needsInspection.length}
              href="/trade-phases"
              accent="orange"
              emptyText="No phases awaiting inspection."
              items={sprint2.needsInspection.map((p) => ({
                key: p.id,
                href: `/trade-phases/${p.id}`,
                primary: p.title,
                secondary: p.project?.name ?? "\u2014",
              }))}
            />
            <AttentionCard
              title="Open punch items"
              count={sprint2.openPunch.length}
              href="/punch-items"
              emptyText="No open punch items."
              items={sprint2.openPunch.map((p) => ({
                key: p.id,
                href: `/trade-phases/${p.trade_phase_id}`,
                primary: p.title,
                badge: p.priority,
              }))}
            />
            <AttentionCard
              title="Overdue punch items"
              count={sprint2.overduePunch.length}
              href="/punch-items"
              accent="red"
              emptyText="Nothing overdue."
              items={sprint2.overduePunch.map((p) => ({
                key: p.id,
                href: `/trade-phases/${p.trade_phase_id}`,
                primary: p.title,
                secondary: p.due_date ? `Due ${formatDate(p.due_date)}` : undefined,
                badge: p.priority,
              }))}
            />
          </div>

          {/* Sprint 3 attention sections */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AttentionCard
              title="Pinned documents"
              count={sprint3.pinnedDocuments.length}
              href="/documents"
              emptyText="No pinned blueprints or layouts yet."
              items={sprint3.pinnedDocuments.map((d) => ({
                key: d.id,
                href: "/documents",
                primary: d.name,
                badge: d.document_type,
              }))}
            />
            <AttentionCard
              title="Recently uploaded"
              count={sprint3.recentDocuments.length}
              href="/documents"
              emptyText="No documents uploaded yet."
              items={sprint3.recentDocuments.map((d) => ({
                key: d.id,
                href: "/documents",
                primary: d.name,
                secondary: `Added ${timeAgo(d.created_at)}`,
              }))}
            />
            <AttentionCard
              title="Pending confirmations"
              count={sprint3.pendingConfirmations.length}
              href="/trade-phases"
              accent="amber"
              emptyText="No schedule confirmations awaiting a reply."
              items={sprint3.pendingConfirmations.map((p) => ({
                key: p.id,
                href: `/trade-phases/${p.id}`,
                primary: p.title,
                secondary: p.project?.name ?? "\u2014",
              }))}
            />
            <AttentionCard
              title="Declined confirmations"
              count={sprint3.declinedConfirmations.length}
              href="/trade-phases"
              accent="red"
              emptyText="No contractors have declined a scheduled date."
              items={sprint3.declinedConfirmations.map((p) => ({
                key: p.id,
                href: `/trade-phases/${p.id}`,
                primary: p.title,
                secondary: p.schedule_confirmation_note
                  ? p.schedule_confirmation_note
                  : (p.project?.name ?? "\u2014"),
              }))}
            />
            <AttentionCard
              title="Contractor punch updates"
              count={sprint3.contractorPunchUpdates.length}
              href="/punch-items"
              accent="orange"
              emptyText="No unresolved updates from contractors."
              items={sprint3.contractorPunchUpdates.map((p) => ({
                key: p.id,
                href: `/trade-phases/${p.trade_phase_id}`,
                primary: p.title,
                secondary: p.contractor_notes ?? undefined,
                badge: p.status,
              }))}
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

          {/* Recent notifications */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Recent notifications</CardTitle>
              <Link
                href="/notifications"
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardBody className="p-0">
              {sprint3.recentNotifications.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-500">
                  Notifications will appear here as events happen.
                </p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {sprint3.recentNotifications.map((n) => (
                    <li
                      key={n.id}
                      className="flex items-start gap-3 px-5 py-3"
                    >
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          NOTIFICATION_TYPE_STYLES[n.notification_type],
                        )}
                      >
                        {NOTIFICATION_TYPE_LABELS[n.notification_type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink-800">{n.message}</p>
                        <p className="text-xs text-ink-400">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
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

interface AttentionItem {
  key: string;
  primary: string;
  secondary?: string;
  href?: string;
  badge?: string;
}

const COUNT_ACCENTS: Record<string, string> = {
  brand: "bg-brand-50 text-brand-700",
  amber: "bg-amber-100 text-amber-800",
  orange: "bg-orange-100 text-orange-800",
  red: "bg-red-100 text-red-800",
};

/** A compact "needs attention" list card for the dashboard. */
function AttentionCard({
  title,
  count,
  href,
  items,
  emptyText,
  accent = "brand",
}: {
  title: string;
  count: number;
  href: string;
  items: AttentionItem[];
  emptyText: string;
  accent?: "brand" | "amber" | "orange" | "red";
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <span
          className={cn(
            "inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
            COUNT_ACCENTS[accent],
          )}
        >
          {count}
        </span>
      </CardHeader>
      <CardBody className="p-0">
        {items.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-ink-400">
            {emptyText}
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.slice(0, 5).map((item) => {
              const body = (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {item.primary}
                    </p>
                    {item.secondary && (
                      <p className="truncate text-xs text-ink-500">
                        {item.secondary}
                      </p>
                    )}
                  </div>
                  {item.badge && (
                    <span className="shrink-0 text-xs font-medium text-ink-500">
                      {item.badge}
                    </span>
                  )}
                </div>
              );
              return (
                <li key={item.key}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="block px-5 py-3 hover:bg-ink-50"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="px-5 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {items.length > 5 && (
          <Link
            href={href}
            className="block border-t border-ink-100 px-5 py-2 text-center text-xs font-medium text-brand-600 hover:underline"
          >
            View all {count}
          </Link>
        )}
      </CardBody>
    </Card>
  );
}

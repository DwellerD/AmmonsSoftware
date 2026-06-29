"use client";

import { useEffect, useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/ui/States";
import { listNotifications, markNotificationRead } from "@/lib/api";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_STYLES,
} from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  Notification,
  NotificationStatus,
  NotificationType,
} from "@/lib/database.types";

/**
 * Notification history screen (GC view).
 *
 * The app records notifications (it does not send real SMS/email/push yet) so
 * the team can verify the right events fire. Each row shows the recipient,
 * type, related entity, message, prepared delivery status, and timestamp.
 * Filters narrow the list by status and type. Records can be marked read.
 */
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"" | NotificationStatus>("");
  const [typeFilter, setTypeFilter] = useState<"" | NotificationType>("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        setNotifications(await listNotifications());
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load notifications.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.status === "unread").length,
    [notifications],
  );

  // The notification types actually present, for a focused type dropdown.
  const presentTypes = useMemo(() => {
    const set = new Set<NotificationType>();
    notifications.forEach((n) => set.add(n.notification_type));
    return Array.from(set);
  }, [notifications]);

  const visible = useMemo(
    () =>
      notifications.filter((n) => {
        if (statusFilter && n.status !== statusFilter) return false;
        if (typeFilter && n.notification_type !== typeFilter) return false;
        return true;
      }),
    [notifications, statusFilter, typeFilter],
  );

  async function handleMarkRead(id: string) {
    const previous = notifications;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" } : n)),
    );
    try {
      await markNotificationRead(id);
    } catch {
      setNotifications(previous);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        description={`Event records for visibility and testing. ${unreadCount} unread.`}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-md">
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "" | NotificationStatus)
          }
        >
          <option value="">All statuses</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </Select>
        <Select
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "" | NotificationType)}
        >
          <option value="">All types</option>
          {presentTypes.map((t) => (
            <option key={t} value={t}>
              {NOTIFICATION_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingState message="Loading notifications…" />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Requesting a schedule confirmation, assigning a punch item, or reviewing completion proof will create records here."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No notifications match these filters"
          description="Try clearing a filter to see more."
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {visible.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-5 py-4",
                    n.status === "unread" && "bg-brand-50/40",
                  )}
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
                    <p className="mt-0.5 text-xs text-ink-400">
                      {n.recipient_id ? `To ${n.recipient_id}` : "Broadcast"}
                      {` · ${n.related_entity_type}`}
                      {` · ${timeAgo(n.created_at)}`}
                      {n.email_status && n.email_status !== "skipped"
                        ? ` · email ${n.email_status}`
                        : ""}
                    </p>
                  </div>
                  {n.status === "unread" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMarkRead(n.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </PageContainer>
  );
}

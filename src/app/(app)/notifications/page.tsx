"use client";

import { useEffect, useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/ui/States";
import { listNotifications, markNotificationRead } from "@/lib/api";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_STYLES,
} from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Notification } from "@/lib/database.types";

/**
 * Notifications screen (development/testing view).
 *
 * Sprint 2 does not send real SMS/email/push — instead it records what *would*
 * be sent. This screen lists those records so the team can verify the right
 * events fire. Records can be marked read.
 */
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        description={`Event records for development and testing. ${unreadCount} unread.`}
      />

      {loading ? (
        <LoadingState message="Loading notifications…" />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Submitting completion proof, assigning punch items, or marking a material delayed will create records here."
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {notifications.map((n) => (
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
                      {n.recipient_id
                        ? `To ${n.recipient_id} · `
                        : "Broadcast · "}
                      {timeAgo(n.created_at)}
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

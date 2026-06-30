import { createNotification, type NewNotificationInput } from "@/lib/api";
// FUTURE FEATURE:
// buildActionLinkUrl embedded an action link inside outbound email/SMS bodies.
// Re-enable this import when real messaging delivery is added back.
// import { buildActionLinkUrl } from "@/lib/actionLinks";
import type {
  Notification,
  NotificationDeliveryStatus,
  NotificationType,
} from "@/lib/database.types";

/**
 * Notification service.
 *
 * For the current GC-focused MVP this only creates internal Firestore
 * notification records (which feed the dashboard/activity history) and formats
 * their messages. It does NOT send email/SMS/push.
 *
 * FUTURE FEATURE:
 * The email/SMS "prepare" helpers below are intentionally kept but no longer
 * called by dispatchNotification. They are preserved as the seam for wiring a
 * real provider (e.g. Cloud Functions + SendGrid/Twilio) in a later version,
 * when automated messaging and/or a contractor portal are added.
 */

/** True when email delivery has been switched on via env config. */
export function isEmailDeliveryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_NOTIFICATIONS_EMAIL_ENABLED === "true";
}

/** SMS is scaffolded but never sent in this build. */
export function isSmsDeliveryEnabled(): boolean {
  return false;
}

/** Context used to format a notification message and attach entity data. */
export interface NotificationContext {
  /** Display name of what the notification is about (e.g. phase/punch title). */
  subject?: string;
  /** Project name, when known, for extra context. */
  projectName?: string | null;
  /** Optional due date (ISO) to mention. */
  dueDate?: string | null;
  /** Optional free-form detail (e.g. inspection/decline notes). */
  detail?: string | null;
}

/** Builds a human-friendly message for a notification type + context. */
export function formatNotificationMessage(
  type: NotificationType,
  ctx: NotificationContext = {},
): string {
  const subject = ctx.subject ?? "a task";
  const project = ctx.projectName ? ` (${ctx.projectName})` : "";
  switch (type) {
    case "schedule_confirmation_requested":
      return `Please confirm your schedule for ${subject}${project}.`;
    case "schedule_confirmation_declined":
      return `The contractor declined the schedule for ${subject}${project}.${
        ctx.detail ? ` Reason: ${ctx.detail}` : ""
      }`;
    case "punch_item_assigned":
      return `You've been assigned a punch item: ${subject}${project}.${
        ctx.dueDate ? ` Due ${ctx.dueDate}.` : ""
      }`;
    case "completion_approved":
      return `Your completion submission for ${subject}${project} was approved.`;
    case "completion_rejected":
      return `Your completion submission for ${subject}${project} needs rework.${
        ctx.detail ? ` Notes: ${ctx.detail}` : ""
      }`;
    case "completion_submitted":
      return `Completion proof was submitted for ${subject}${project}.`;
    case "material_delayed":
      return `A material order is delayed for ${subject}${project}.`;
  }
}

export interface PreparedDelivery {
  channel: "email" | "sms";
  to: string | null;
  subject?: string;
  body: string;
  status: NotificationDeliveryStatus;
}

/**
 * Prepares (but does not send) an email for a notification. Returns a payload
 * and a status: "queued" when email is enabled and we have a recipient, else
 * "skipped". Swap the body of this function for a real provider call later.
 */
export function prepareEmailDelivery(args: {
  to?: string | null;
  subject: string;
  body: string;
  linkUrl?: string | null;
}): PreparedDelivery {
  const body = args.linkUrl ? `${args.body}\n\nOpen: ${args.linkUrl}` : args.body;
  const status: NotificationDeliveryStatus =
    isEmailDeliveryEnabled() && args.to ? "queued" : "skipped";
  return { channel: "email", to: args.to ?? null, subject: args.subject, body, status };
}

/** Prepares an SMS payload. Always "not_enabled" in this build. */
export function prepareSmsDelivery(args: {
  to?: string | null;
  body: string;
  linkUrl?: string | null;
}): PreparedDelivery {
  const body = args.linkUrl ? `${args.body} ${args.linkUrl}` : args.body;
  return { channel: "sms", to: args.to ?? null, body, status: "not_enabled" };
}

export interface DispatchNotificationInput {
  recipientId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  type: NotificationType;
  relatedEntityType: string;
  relatedEntityId: string;
  context?: NotificationContext;
  /** Optional explicit message; defaults to the formatted message. */
  message?: string;
  /** Related contractor action link token, if any. */
  actionLinkToken?: string | null;
}

export interface DispatchResult {
  notification: Notification;
  email: PreparedDelivery;
  sms: PreparedDelivery;
}

/**
 * Records a notification. For the current MVP this only writes the internal
 * Firestore record (so the event shows in dashboard/activity history). It does
 * not send anything.
 *
 * FUTURE FEATURE:
 * Email/SMS preparation and dispatch are intentionally disabled here. When real
 * delivery is added back, re-introduce prepareEmailDelivery/prepareSmsDelivery
 * (and the action-link URL) and return them alongside the record. The input
 * already accepts recipientEmail/recipientPhone/actionLinkToken so call sites
 * won't need to change.
 */
export async function dispatchNotification(
  input: DispatchNotificationInput,
): Promise<Notification> {
  const message =
    input.message ?? formatNotificationMessage(input.type, input.context);

  const record: NewNotificationInput = {
    recipient_id: input.recipientId ?? null,
    notification_type: input.type,
    related_entity_type: input.relatedEntityType,
    related_entity_id: input.relatedEntityId,
    message,
    action_link_token: input.actionLinkToken ?? null,
    // FUTURE FEATURE: no messaging is sent yet, so there is no email status.
    email_status: null,
  };
  return createNotification(record);
}

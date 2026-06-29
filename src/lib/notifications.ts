import { createNotification, type NewNotificationInput } from "@/lib/api";
import { buildActionLinkUrl } from "@/lib/actionLinks";
import type {
  Notification,
  NotificationDeliveryStatus,
  NotificationType,
} from "@/lib/database.types";

/**
 * Notification delivery service.
 *
 * Central place to create notification records, format their messages, attach
 * related entity context, and *prepare* email/SMS delivery. This build does not
 * actually send email or SMS — those channels return a prepared payload with a
 * status so the workflow is ready to wire up to a real provider later without
 * touching the call sites.
 *
 * Enable email by setting NEXT_PUBLIC_NOTIFICATIONS_EMAIL_ENABLED=true once a
 * provider is connected. SMS is intentionally left "not enabled".
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
 * Creates a notification record and prepares its delivery channels. Always
 * writes the Firestore record (so it shows in the notification history) even
 * when email/SMS are not configured.
 */
export async function dispatchNotification(
  input: DispatchNotificationInput,
): Promise<DispatchResult> {
  const message =
    input.message ?? formatNotificationMessage(input.type, input.context);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const linkUrl =
    input.actionLinkToken && origin
      ? buildActionLinkUrl(origin, input.actionLinkToken)
      : null;

  const email = prepareEmailDelivery({
    to: input.recipientEmail,
    subject: input.context?.subject
      ? `TradeFlow: ${input.context.subject}`
      : "TradeFlow notification",
    body: message,
    linkUrl,
  });
  const sms = prepareSmsDelivery({
    to: input.recipientPhone,
    body: message,
    linkUrl,
  });

  const record: NewNotificationInput = {
    recipient_id: input.recipientId ?? null,
    notification_type: input.type,
    related_entity_type: input.relatedEntityType,
    related_entity_id: input.relatedEntityId,
    message,
    action_link_token: input.actionLinkToken ?? null,
    email_status: email.status,
  };
  const notification = await createNotification(record);

  return { notification, email, sms };
}

import { ACTION_LINK_DEFAULT_TTL_DAYS } from "@/lib/constants";
import type {
  ActionLinkEntityType,
  ActionLinkType,
  ContractorActionLink,
} from "@/lib/database.types";

/**
 * Pure helpers for contractor action links. Kept free of Firebase so they can
 * be unit-tested and reused on both the GC and contractor sides.
 */

/**
 * Generates an unguessable URL-safe token. Uses the Web Crypto API when
 * available (browser + modern Node), falling back to Math.random only as a last
 * resort. The token doubles as the Firestore document id for the link.
 */
export function generateActionToken(): string {
  const bytes = new Uint8Array(24);
  const cryptoObj =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Base64url without padding.
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Returns an ISO expiration date `days` from now (default TTL). */
export function defaultExpiration(
  days: number = ACTION_LINK_DEFAULT_TTL_DAYS,
): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** True if the link has an expiration date that is in the past. */
export function isActionLinkExpired(
  link: Pick<ContractorActionLink, "expiration_date">,
  now: Date = new Date(),
): boolean {
  if (!link.expiration_date) return false;
  return new Date(link.expiration_date).getTime() < now.getTime();
}

/**
 * Computes the *effective* status of a link, treating an Active-but-past-expiry
 * link as Expired without needing a write. Revoked/Used always win.
 */
export function effectiveActionLinkStatus(
  link: ContractorActionLink,
  now: Date = new Date(),
): ContractorActionLink["status"] {
  if (link.status === "Revoked" || link.status === "Used") return link.status;
  if (isActionLinkExpired(link, now)) return "Expired";
  return link.status;
}

/** Relative path a contractor opens to use the link. */
export function buildActionLinkPath(token: string): string {
  return `/link/${token}`;
}

/** Absolute URL for the link, given an origin (e.g. window.location.origin). */
export function buildActionLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${buildActionLinkPath(token)}`;
}

/** The entity type a given action type points at. */
export function entityTypeForAction(
  action: ActionLinkType,
): ActionLinkEntityType {
  switch (action) {
    case "Schedule Confirmation":
      return "trade_phase";
    case "Completion Submission":
      return "completion_record";
    case "Punch Item Update":
      return "punch_item";
    case "Document Request":
      return "document_request";
  }
}

/**
 * Whether an action link may be opened more than once after being used. Some
 * actions (schedule confirm, completion submit) are one-and-done; others (punch
 * item updates, document requests) can reasonably be revisited.
 */
export function allowsRepeatAccess(action: ActionLinkType): boolean {
  return action === "Punch Item Update" || action === "Document Request";
}

"use client";

import { useEffect, useState } from "react";
import { ScheduleConfirmationAction } from "@/components/contractor/ScheduleConfirmationAction";
import { PunchItemUpdateAction } from "@/components/contractor/PunchItemUpdateAction";
import { Spinner } from "@/components/ui/States";
import {
  ensureAnonymousSession,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import {
  getActionLinkByToken,
  getPunchItem,
  getTradePhase,
} from "@/lib/api";
import {
  validateActionLink,
  type ActionLinkInvalidReason,
} from "@/lib/actionLinks";
import type {
  ContractorActionLink,
  PunchItem,
  TradePhaseWithRelations,
} from "@/lib/database.types";

type LinkError = ActionLinkInvalidReason | "config" | "unavailable" | "load";

const ERROR_COPY: Record<LinkError, { title: string; body: string }> = {
  config: {
    title: "Not available",
    body: "This site isn't fully configured yet. Please contact the project team.",
  },
  missing: {
    title: "Link not found",
    body: "This link is invalid or no longer exists. Please ask the project team for a new one.",
  },
  expired: {
    title: "Link expired",
    body: "This link has expired. Please ask the project team to send a new one.",
  },
  revoked: {
    title: "Link no longer active",
    body: "This link has been turned off by the project team.",
  },
  used: {
    title: "Already completed",
    body: "Thanks — this action has already been submitted. There's nothing more to do here.",
  },
  mismatch: {
    title: "Link not valid",
    body: "This link doesn't match the request it was created for. Please ask the project team for a new one.",
  },
  unavailable: {
    title: "Not available yet",
    body: "This type of request isn't available yet. Please contact the project team.",
  },
  load: {
    title: "Something went wrong",
    body: "We couldn't load this request. Please try again in a moment.",
  },
};

/**
 * Loads a contractor action link by its token, performs lightweight validation,
 * and renders the matching action UI. Contractors aren't logged in, so we sign
 * in anonymously first to satisfy Firestore rules; the token controls scope.
 */
export function ContractorLinkClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LinkError | null>(null);
  const [link, setLink] = useState<ContractorActionLink | null>(null);
  const [phase, setPhase] = useState<TradePhaseWithRelations | null>(null);
  const [punchItem, setPunchItem] = useState<PunchItem | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      if (!isFirebaseConfigured) {
        if (active) {
          setError("config");
          setLoading(false);
        }
        return;
      }
      try {
        await ensureAnonymousSession();
        const found = await getActionLinkByToken(token);
        if (!active) return;

        // First pass: existence, expiry, revocation, and one-time-use checks.
        const base = validateActionLink(found);
        if (!base.ok) {
          setError(base.reason);
          return;
        }
        const link = found as ContractorActionLink;
        setLink(link);

        if (link.action_type === "Schedule Confirmation") {
          const p = await getTradePhase(link.related_entity_id);
          if (!active) return;
          if (!p) {
            setError("missing");
            return;
          }
          // Second pass: the link must match this entity, its contractor, and
          // its project — so a token can't be reused against other data.
          const match = validateActionLink(link, {
            action: "Schedule Confirmation",
            entityId: p.id,
            contractorId: p.contractor_id,
            projectId: p.project_id,
          });
          if (!match.ok) {
            setError(match.reason);
            return;
          }
          setPhase(p);
        } else if (link.action_type === "Punch Item Update") {
          const pi = await getPunchItem(link.related_entity_id);
          if (!active) return;
          if (!pi) {
            setError("missing");
            return;
          }
          const match = validateActionLink(link, {
            action: "Punch Item Update",
            entityId: pi.id,
            contractorId: pi.assigned_contractor_id,
            projectId: pi.project_id,
          });
          if (!match.ok) {
            setError(match.reason);
            return;
          }
          setPunchItem(pi);
        } else {
          // Other action types are wired up in later prompts.
          setError("unavailable");
        }
      } catch {
        if (active) setError("load");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <span className="text-lg font-semibold text-brand-700">TradeFlow</span>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Spinner />
            <p className="text-sm text-ink-500">Loading…</p>
          </div>
        ) : error ? (
          <div className="space-y-2 text-center">
            <h1 className="text-lg font-semibold text-ink-900">
              {ERROR_COPY[error].title}
            </h1>
            <p className="text-sm text-ink-600">{ERROR_COPY[error].body}</p>
          </div>
        ) : link && link.action_type === "Schedule Confirmation" && phase ? (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-ink-900">
              Confirm your schedule
            </h1>
            <ScheduleConfirmationAction link={link} phase={phase} />
          </div>
        ) : link && link.action_type === "Punch Item Update" && punchItem ? (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-ink-900">
              Punch item update
            </h1>
            <PunchItemUpdateAction link={link} item={punchItem} />
          </div>
        ) : null}
      </div>

      <p className="mt-6 text-center text-xs text-ink-400">
        Sent by your project team via TradeFlow.
      </p>
    </main>
  );
}

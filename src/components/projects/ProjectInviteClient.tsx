"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  acceptProjectInvite,
  getProjectInviteByToken,
  rejectProjectInvite,
} from "@/lib/api";
import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  buildProjectInvitePath,
  projectPermissionsSummary,
} from "@/lib/projectSharing";
import type { ProjectInvite } from "@/lib/database.types";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { ErrorAlert, LoadingState } from "@/components/ui/States";

interface ProjectInviteClientProps {
  token: string;
}

export function ProjectInviteClient({ token }: ProjectInviteClientProps) {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [invite, setInvite] = useState<ProjectInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextInvite = await getProjectInviteByToken(token);
        if (!active) return;
        setInvite(nextInvite);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Invite not found.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return <LoadingState message="Loading invite…" />;
  }

  if (error) {
    return <ErrorAlert message={error} />;
  }

  if (!invite) {
    return <ErrorAlert message="This invite could not be found." />;
  }

  if (invite.status === "Revoked" || invite.status === "Expired") {
    return (
      <Card>
        <CardBody className="space-y-3 text-sm text-ink-600">
          <h1 className="text-xl font-semibold text-ink-900">Invite unavailable</h1>
          <p>This invite is {invite.status.toLowerCase()}.</p>
          <p>
            Project: <span className="font-medium text-ink-800">{invite.project_name}</span>
          </p>
          <p>
            Invited by: <span className="font-medium text-ink-800">{invite.invited_by_email ?? "Unknown"}</span>
          </p>
          <p className="text-xs text-ink-500">Token path: {buildProjectInvitePath(token)}</p>
        </CardBody>
      </Card>
    );
  }

  if (invite.status === "Rejected") {
    return (
      <Card>
        <CardBody className="space-y-4 text-sm text-ink-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              Project invite
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink-900">
              Invite declined
            </h1>
            <p className="mt-2">
              You declined access to {invite.project_name}.
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Invited by {invite.invited_by_email ?? "a project manager"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/projects">
              <Button variant="outline">Back to projects</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (invite.status === "Accepted") {
    return (
      <Card>
        <CardBody className="space-y-4 text-sm text-ink-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              Project invite
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink-900">
              Invite accepted
            </h1>
            <p className="mt-2">
              You already have access to {invite.project_name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/projects/${invite.project_id}`}>
              <Button>Open project</Button>
            </Link>
            <Link href="/projects">
              <Button variant="outline">Back to projects</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  const inviteProjectId = invite.project_id;

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      await acceptProjectInvite(token);
      router.push(`/projects/${inviteProjectId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite.");
    } finally {
      setAccepting(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    setError(null);
    try {
      const nextInvite = await rejectProjectInvite(token);
      setInvite(nextInvite);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject invite.");
    } finally {
      setRejecting(false);
    }
  }

  async function handleSwitchAccount() {
    setSwitchingAccount(true);
    setError(null);
    try {
      await signOut(getFirebaseAuth());
      router.push(loginHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch accounts.");
    } finally {
      setSwitchingAccount(false);
    }
  }

  const loginHref = `/login?redirectTo=${encodeURIComponent(`/invite/${token}`)}`;
  const emailMatches =
    firebaseUser?.email &&
    firebaseUser.email.toLowerCase() === invite.invited_email.toLowerCase();

  return (
    <Card>
      <CardBody className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
            Project invite
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-ink-900">
            You&apos;ve been invited to {invite.project_name}
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            This invite grants: {projectPermissionsSummary(invite)}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            Invited by: {invite.invited_by_email ?? "a project manager"}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            Invitee: {invite.invited_email}
          </p>
        </div>

        {invite.message && (
          <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700">
            <p className="font-medium text-ink-900">Message</p>
            <p className="mt-1 whitespace-pre-wrap">{invite.message}</p>
          </div>
        )}

        {!firebaseUser ? (
          <div className="space-y-3 rounded-2xl border border-slate-300 bg-slate-100 p-4 text-sm text-slate-900">
            <p className="font-semibold text-slate-950">Sign in to accept</p>
            <p>
              Use the email address {invite.invited_email} to accept this invite.
            </p>
            <Link href={loginHref}>
              <Button>Sign in or create account</Button>
            </Link>
          </div>
        ) : !emailMatches ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-100 p-4 text-sm text-amber-950">
            <p className="font-semibold text-amber-950">Wrong account</p>
            <p>
              You are signed in as {firebaseUser.email}. This invite was sent to
              {" "}
              {invite.invited_email}.
            </p>
            <Button
              variant="outline"
              onClick={handleSwitchAccount}
              loading={switchingAccount}
            >
              Switch account
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleAccept} loading={accepting}>
              Accept invite
            </Button>
            <Button
              variant="outline"
              onClick={handleReject}
              loading={rejecting}
            >
              Reject invite
            </Button>
            <Link href="/projects">
              <Button variant="outline">Back to projects</Button>
            </Link>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

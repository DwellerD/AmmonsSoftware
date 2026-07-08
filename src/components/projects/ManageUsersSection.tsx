"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildProjectInviteUrl,
  PROJECT_PERMISSION_OPTIONS,
  permissionStateFromFields,
  projectPermissionsSummary,
  type ProjectPermissionState,
} from "@/lib/projectSharing";
import {
  createProjectInvite,
  getMyProjectAccess,
  listProjectInvites,
  listProjectMembers,
  removeProjectAccess,
  revokeProjectInvite,
  updateProjectAccess,
} from "@/lib/api";
import type { ProjectAccess, ProjectInvite } from "@/lib/database.types";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorAlert, LoadingState } from "@/components/ui/States";
import { Field, Input } from "@/components/ui/Field";

interface ManageUsersSectionProps {
  projectId: string;
  projectName: string;
}

export function ManageUsersSection({
  projectId,
  projectName,
}: ManageUsersSectionProps) {
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [members, setMembers] = useState<ProjectAccess[]>([]);
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [invitePermissions, setInvitePermissions] =
    useState<ProjectPermissionState>(() =>
      permissionStateFromFields({
        can_view_project: true,
        can_view_trades: true,
        can_view_trade_phases: true,
      }),
    );
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberDrafts, setMemberDrafts] = useState<Record<string, ProjectPermissionState>>({});

  const canManage = Boolean(access?.can_manage_members);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [myAccess, projectMembers, projectInvites] = await Promise.all([
          getMyProjectAccess(projectId),
          listProjectMembers(projectId),
          listProjectInvites(projectId),
        ]);
        if (!active) return;
        setAccess(myAccess);
        setMembers(projectMembers);
        setInvites(projectInvites);
        const drafts: Record<string, ProjectPermissionState> = {};
        projectMembers.forEach((member) => {
          drafts[member.user_id] = permissionStateFromFields(member);
        });
        setMemberDrafts(drafts);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load users.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [projectId]);

  const memberRows = useMemo(() => {
    return members.map((member) => ({
      ...member,
      summary: projectPermissionsSummary(member),
    }));
  }, [members]);

  if (loading) {
    return <LoadingState message="Loading project users…" />;
  }

  if (error) {
    return <ErrorAlert message={error} />;
  }

  if (!canManage) {
    return null;
  }

  async function refresh() {
    const [projectMembers, projectInvites] = await Promise.all([
      listProjectMembers(projectId),
      listProjectInvites(projectId),
    ]);
    setMembers(projectMembers);
    setInvites(projectInvites);
    setMemberDrafts((current) => {
      const next = { ...current };
      projectMembers.forEach((member) => {
        next[member.user_id] = permissionStateFromFields(member);
      });
      return next;
    });
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSavingId("invite");
    setError(null);
    try {
      const invite = await createProjectInvite({
        project_id: projectId,
        project_name: projectName,
        invited_email: inviteEmail,
        message: inviteMessage,
        permissions: invitePermissions,
      });
      const url = buildProjectInviteUrl(window.location.origin, invite.token);
      setInviteUrl(url);
      setInviteEmail("");
      setInviteMessage("");
      setInvitePermissions(
        permissionStateFromFields({
          can_view_project: true,
          can_view_trades: true,
          can_view_trade_phases: true,
        }),
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveMember(member: ProjectAccess) {
    setSavingId(member.user_id);
    setError(null);
    try {
      const draft = memberDrafts[member.user_id] ?? permissionStateFromFields(member);
      await updateProjectAccess(projectId, member.user_id, {
        ...draft,
        email: member.email,
      });
      setEditingMemberId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update access.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleRemoveMember(member: ProjectAccess) {
    if (member.user_id === access?.user_id) {
      return;
    }
    setSavingId(member.user_id);
    setError(null);
    try {
      await removeProjectAccess(projectId, member.user_id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleRevokeInvite(token: string) {
    setSavingId(token);
    setError(null);
    try {
      await revokeProjectInvite(token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invite.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCopyInviteLink(token: string) {
    const url = buildProjectInviteUrl(window.location.origin, token);
    await navigator.clipboard.writeText(url);
    setInviteUrl(url);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Manage users</CardTitle>
          <p className="mt-1 text-sm text-ink-500">
            Invite GC/site supers to this project and control exactly what they
            can see or edit.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        {inviteUrl && (
          <div className="rounded-2xl border border-brand-500/30 bg-surface p-4 text-sm text-ink-700">
            <p className="font-medium text-ink-900">Invite link ready</p>
            <p className="mt-1 break-all text-xs text-ink-600">{inviteUrl}</p>
          </div>
        )}

        <form onSubmit={handleInvite} className="space-y-4 rounded-2xl border border-ink-200 bg-surface p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Invite email" htmlFor="invite-email" required>
              <Input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="superintendent@company.com"
              />
            </Field>
            <Field label="Message" htmlFor="invite-message">
              <Input
                id="invite-message"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Optional note for the invitee"
              />
            </Field>
          </div>

          <PermissionChecklist
            value={invitePermissions}
            onChange={setInvitePermissions}
            title="Invite permissions"
            description="Pick exactly what this person can view or edit."
            defaultOpen={false}
          />

          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={savingId === "invite"}>
              Create invite
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Members</h3>
              <p className="text-xs text-ink-500">Active project access.</p>
            </div>
          </div>

          <div className="space-y-3">
            {memberRows.map((member) => {
              const isOwner = member.user_id === access?.user_id;
              const isEditing = editingMemberId === member.user_id;
              return (
                <div key={member.id} className="rounded-2xl border border-ink-200 bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">
                        {member.email ?? member.user_id}
                        {isOwner ? " (you)" : ""}
                      </p>
                      <p className="text-xs text-ink-500">{member.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isOwner && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingMemberId(isEditing ? null : member.user_id)}
                        >
                          {isEditing ? "Close" : "Edit access"}
                        </Button>
                      )}
                      {!isOwner && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveMember(member)}
                          loading={savingId === member.user_id}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-4 border-t border-ink-100 pt-4">
                      <PermissionChecklist
                        value={memberDrafts[member.user_id] ?? permissionStateFromFields(member)}
                        onChange={(next) =>
                          setMemberDrafts((current) => ({
                            ...current,
                            [member.user_id]: next,
                          }))
                        }
                        title="Edit permissions"
                        description="Change exactly what this person can see or edit."
                        defaultOpen
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          type="button"
                          loading={savingId === member.user_id}
                          onClick={() => handleSaveMember(member)}
                        >
                          Save access
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setEditingMemberId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Pending invites</h3>
            <p className="text-xs text-ink-500">Share the link or send it from your email client.</p>
          </div>

          <div className="space-y-3">
            {invites.map((invite) => {
              const url = buildProjectInviteUrl(window.location.origin, invite.token);
              return (
                <div key={invite.id} className="rounded-2xl border border-ink-200 bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{invite.invited_email}</p>
                      <p className="text-xs text-ink-500">
                        {invite.status} · {projectPermissionsSummary(invite)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyInviteLink(invite.token)}
                      >
                        Copy link
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeInvite(invite.token)}
                        loading={savingId === invite.token}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 break-all text-xs text-ink-500">{url}</p>
                </div>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

interface PermissionChecklistProps {
  title: string;
  description: string;
  value: ProjectPermissionState;
  onChange: (next: ProjectPermissionState) => void;
  defaultOpen?: boolean;
}

function PermissionChecklist({
  title,
  description,
  value,
  onChange,
  defaultOpen = false,
}: PermissionChecklistProps) {
  const [open, setOpen] = useState(defaultOpen);
  const selectedCount = PROJECT_PERMISSION_OPTIONS.filter(
    (option) => value[option.field],
  ).length;

  return (
    <div className="rounded-2xl border border-ink-200 bg-ink-50/60">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h4 className="text-sm font-semibold text-ink-900">{title}</h4>
          <p className="text-xs text-ink-500">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-ink-200 bg-surface px-2.5 py-1 text-xs font-medium text-ink-600">
            {selectedCount} selected
          </span>
          <span className="text-xs font-medium text-ink-600">
            {open ? "Hide" : "Show"}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-ink-200 px-4 pb-4 pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            {PROJECT_PERMISSION_OPTIONS.map((option) => (
              <label
                key={option.field}
                className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-surface p-3"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-ink-300 text-brand-600"
                  checked={value[option.field]}
                  onChange={(e) =>
                    onChange(
                      permissionStateFromFields({
                        ...value,
                        [option.field]: e.target.checked,
                      }),
                    )
                  }
                />
                <span>
                  <span className="block text-sm font-medium text-ink-900">{option.label}</span>
                  <span className="block text-xs text-ink-500">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

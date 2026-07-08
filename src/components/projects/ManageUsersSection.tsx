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
  listProjectMembers,
  removeProjectAccess,
  revokeProjectInvitesForEmail,
  updateProjectAccess,
} from "@/lib/api";
import type { ProjectAccess } from "@/lib/database.types";
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
  const [memberDialogTarget, setMemberDialogTarget] =
    useState<ProjectAccess | null>(null);
  const [memberDrafts, setMemberDrafts] = useState<
    Record<string, ProjectPermissionState>
  >({});

  const canManage = Boolean(access?.can_manage_members);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [myAccess, projectMembers] = await Promise.all([
          getMyProjectAccess(projectId),
          listProjectMembers(projectId),
        ]);
        if (!active) return;

        setAccess(myAccess);
        setMembers(projectMembers);

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

    void load();
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

  const activeMember = memberDialogTarget
    ? members.find((member) => member.user_id === memberDialogTarget.user_id) ??
      memberDialogTarget
    : null;

  const activeMemberDraft = activeMember
    ? memberDrafts[activeMember.user_id] ?? permissionStateFromFields(activeMember)
    : null;

  function openMemberDialog(member: ProjectAccess) {
    setMemberDialogTarget(member);
  }

  function closeMemberDialog() {
    setMemberDialogTarget(null);
  }

  async function refresh() {
    const projectMembers = await listProjectMembers(projectId);
    setMembers(projectMembers);
    setMemberDrafts((current) => {
      const next = { ...current };
      projectMembers.forEach((member) => {
        next[member.user_id] = permissionStateFromFields(member);
      });
      return next;
    });

    if (
      memberDialogTarget &&
      !projectMembers.some((member) => member.user_id === memberDialogTarget.user_id)
    ) {
      closeMemberDialog();
    }
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
    setSavingId(`save:${member.user_id}`);
    setError(null);
    try {
      const draft =
        memberDrafts[member.user_id] ?? permissionStateFromFields(member);
      await updateProjectAccess(projectId, member.user_id, {
        ...draft,
        email: member.email,
      });
      closeMemberDialog();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update access.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleRevokeAllAccess(member: ProjectAccess) {
    if (member.user_id === access?.user_id) {
      return;
    }

    const confirmed = window.confirm(
      `Revoke all access for ${member.email ?? member.user_id}? They will immediately lose visibility to this project.`,
    );
    if (!confirmed) {
      return;
    }

    setSavingId(`revoke:${member.user_id}`);
    setError(null);
    try {
      await removeProjectAccess(projectId, member.user_id);
      if (member.email) {
        await revokeProjectInvitesForEmail(projectId, member.email);
      }
      closeMemberDialog();
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to revoke member access.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
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

          <form
            onSubmit={handleInvite}
            className="space-y-4 rounded-2xl border border-ink-200 bg-surface p-4"
          >
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
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Members</h3>
              <p className="text-xs text-ink-500">Active project access.</p>
            </div>

            {memberRows.length === 0 ? (
              <p className="rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
                No members have access to this project yet.
              </p>
            ) : (
              <div className="space-y-3">
                {memberRows.map((member) => {
                  const isSelf = member.user_id === access?.user_id;
                  return (
                    <div
                      key={member.id}
                      className="rounded-2xl border border-ink-200 bg-surface p-4"
                      aria-label={`Member ${member.email ?? member.user_id}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink-900">
                            {member.email ?? member.user_id}
                            {isSelf ? " (you)" : ""}
                          </p>
                          <p className="text-xs text-ink-500">{member.summary}</p>
                        </div>
                        {!isSelf && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openMemberDialog(member)}
                          >
                            Edit access
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {activeMember && activeMemberDraft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/45 p-4 pt-8">
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-member-dialog-title"
            className="w-full max-w-3xl overflow-hidden"
          >
            <CardHeader className="flex items-center justify-between gap-3">
              <div>
                <CardTitle id="manage-member-dialog-title">
                  Edit access for {activeMember.email ?? activeMember.user_id}
                </CardTitle>
                <p className="mt-1 text-xs text-ink-500">
                  Current access: {projectPermissionsSummary(activeMember)}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeMemberDialog}>
                Close
              </Button>
            </CardHeader>

            <CardBody className="max-h-[70vh] space-y-4 overflow-y-auto">
              <PermissionChecklist
                value={activeMemberDraft}
                onChange={(next) =>
                  setMemberDrafts((current) => ({
                    ...current,
                    [activeMember.user_id]: next,
                  }))
                }
                title="Edit permissions"
                description="Change exactly what this person can see or edit."
                defaultOpen
              />

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  loading={savingId === `save:${activeMember.user_id}`}
                  onClick={() => handleSaveMember(activeMember)}
                >
                  Save access
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  loading={savingId === `revoke:${activeMember.user_id}`}
                  onClick={() => handleRevokeAllAccess(activeMember)}
                >
                  Revoke all access
                </Button>
                <Button type="button" variant="ghost" onClick={closeMemberDialog}>
                  Cancel
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
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
                  <span className="block text-sm font-medium text-ink-900">
                    {option.label}
                  </span>
                  <span className="block text-xs text-ink-500">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

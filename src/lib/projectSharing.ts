import type { ProjectAccess, ProjectInvite } from "@/lib/database.types";

export type ProjectPermissionField =
  | "can_view_project"
  | "can_edit_project"
  | "can_view_trades"
  | "can_edit_trades"
  | "can_view_trade_phases"
  | "can_edit_trade_phases"
  | "can_view_material_orders"
  | "can_edit_material_orders"
  | "can_view_punch_items"
  | "can_edit_punch_items"
  | "can_view_documents"
  | "can_edit_documents"
  | "can_view_activity"
  | "can_edit_activity"
  | "can_manage_members";

export type ProjectPermissionState = Pick<ProjectAccess, ProjectPermissionField>;

export const PROJECT_PERMISSION_FIELDS: ProjectPermissionField[] = [
  "can_view_project",
  "can_edit_project",
  "can_view_trades",
  "can_edit_trades",
  "can_view_trade_phases",
  "can_edit_trade_phases",
  "can_view_material_orders",
  "can_edit_material_orders",
  "can_view_punch_items",
  "can_edit_punch_items",
  "can_view_documents",
  "can_edit_documents",
  "can_view_activity",
  "can_edit_activity",
  "can_manage_members",
];

export interface ProjectPermissionOption {
  field: ProjectPermissionField;
  label: string;
  description: string;
}

export const PROJECT_PERMISSION_OPTIONS: ProjectPermissionOption[] = [
  {
    field: "can_view_project",
    label: "View project",
    description: "See the project card, overview, and timeline.",
  },
  {
    field: "can_edit_project",
    label: "Edit project",
    description: "Change project details like name, dates, or notes.",
  },
  {
    field: "can_view_trades",
    label: "View trades",
    description: "See the trades attached to this project.",
  },
  {
    field: "can_edit_trades",
    label: "Edit trades",
    description: "Create, edit, or remove trades on this project.",
  },
  {
    field: "can_view_trade_phases",
    label: "View trade phases",
    description: "See phase cards, dates, and status.",
  },
  {
    field: "can_edit_trade_phases",
    label: "Edit trade phases",
    description: "Create or update trade phases for this project.",
  },
  {
    field: "can_view_material_orders",
    label: "View material orders",
    description: "See order status and delivery tracking.",
  },
  {
    field: "can_edit_material_orders",
    label: "Edit material orders",
    description: "Create and update material orders.",
  },
  {
    field: "can_view_punch_items",
    label: "View punch items",
    description: "See punch-list items for this project.",
  },
  {
    field: "can_edit_punch_items",
    label: "Edit punch items",
    description: "Create and update punch-list items.",
  },
  {
    field: "can_view_documents",
    label: "View documents",
    description: "See uploaded plans, contracts, and files.",
  },
  {
    field: "can_edit_documents",
    label: "Edit documents",
    description: "Upload, pin, or remove project documents.",
  },
  {
    field: "can_view_activity",
    label: "View activity",
    description: "See the project activity trail.",
  },
  {
    field: "can_edit_activity",
    label: "Edit activity",
    description: "Reserved for future workflow actions.",
  },
  {
    field: "can_manage_members",
    label: "Manage members",
    description: "Invite users, change access, or revoke sharing.",
  },
];

export function defaultProjectPermissions(): ProjectPermissionState {
  return permissionStateFromFields({
    can_view_project: true,
    can_edit_project: false,
    can_view_trades: true,
    can_edit_trades: false,
    can_view_trade_phases: true,
    can_edit_trade_phases: false,
    can_view_material_orders: false,
    can_edit_material_orders: false,
    can_view_punch_items: false,
    can_edit_punch_items: false,
    can_view_documents: false,
    can_edit_documents: false,
    can_view_activity: false,
    can_edit_activity: false,
    can_manage_members: false,
  });
}

export function fullProjectPermissions(): ProjectPermissionState {
  return permissionStateFromFields({
    can_view_project: true,
    can_edit_project: true,
    can_view_trades: true,
    can_edit_trades: true,
    can_view_trade_phases: true,
    can_edit_trade_phases: true,
    can_view_material_orders: true,
    can_edit_material_orders: true,
    can_view_punch_items: true,
    can_edit_punch_items: true,
    can_view_documents: true,
    can_edit_documents: true,
    can_view_activity: true,
    can_edit_activity: true,
    can_manage_members: true,
  });
}

export function permissionStateFromFields(
  input: Partial<ProjectPermissionState>,
): ProjectPermissionState {
  return {
    can_view_project: Boolean(input.can_view_project),
    can_edit_project: Boolean(input.can_edit_project),
    can_view_trades: Boolean(input.can_view_trades),
    can_edit_trades: Boolean(input.can_edit_trades),
    can_view_trade_phases: Boolean(input.can_view_trade_phases),
    can_edit_trade_phases: Boolean(input.can_edit_trade_phases),
    can_view_material_orders: Boolean(input.can_view_material_orders),
    can_edit_material_orders: Boolean(input.can_edit_material_orders),
    can_view_punch_items: Boolean(input.can_view_punch_items),
    can_edit_punch_items: Boolean(input.can_edit_punch_items),
    can_view_documents: Boolean(input.can_view_documents),
    can_edit_documents: Boolean(input.can_edit_documents),
    can_view_activity: Boolean(input.can_view_activity),
    can_edit_activity: Boolean(input.can_edit_activity),
    can_manage_members: Boolean(input.can_manage_members),
  };
}

export function projectPermissionsSummary(
  permissions: Pick<ProjectPermissionState, ProjectPermissionField>,
): string {
  const labels = PROJECT_PERMISSION_OPTIONS.filter((option) => permissions[option.field])
    .map((option) => option.label)
    .filter(Boolean);
  if (labels.length === 0) return "No access";
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3} more`;
}

export function buildProjectInvitePath(token: string): string {
  return `/invite/${token}`;
}

export function buildProjectInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${buildProjectInvitePath(token)}`;
}

export function hasProjectViewAccess(
  permissions: Pick<ProjectPermissionState, ProjectPermissionField> | null | undefined,
): boolean {
  if (!permissions) return false;
  return PROJECT_PERMISSION_FIELDS.some((field) => permissions[field]);
}

export function canEditProjectSection(
  permissions: Pick<ProjectPermissionState, ProjectPermissionField> | null | undefined,
  field: ProjectPermissionField,
): boolean {
  return Boolean(permissions?.[field]);
}

export function canViewProjectSection(
  permissions: Pick<ProjectPermissionState, ProjectPermissionField> | null | undefined,
  field: ProjectPermissionField,
): boolean {
  return Boolean(permissions?.[field]);
}

export type ProjectMemberSummary = {
  id: string;
  project_id: string;
  user_id: string;
  email: string | null;
  access_level: "owner" | "editor" | "viewer";
  permissions: ProjectPermissionState;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectInviteSummary = {
  id: string;
  token: string;
  project_id: string;
  project_name: string;
  invited_email: string;
  status: ProjectInvite["status"];
  permissions: ProjectPermissionState;
  created_at: string;
  expires_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
};

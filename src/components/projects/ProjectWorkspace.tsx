"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorAlert, LoadingState } from "@/components/ui/States";
import {
  getMyProjectAccess,
  getProject,
  listAllPunchItems,
  listDocuments,
  listMaterialOrders,
  listTradePhases,
  listTrades,
  type TradeWithContractor,
} from "@/lib/api";
import { ManageUsersSection } from "@/components/projects/ManageUsersSection";
import { PinnedPlansSection } from "@/components/documents/PinnedPlansSection";
import {
  DOCUMENT_TYPE_STYLES,
  MATERIAL_ORDER_STATUS_STYLES,
  PUNCH_ITEM_STATUS_STYLES,
  PUNCH_PRIORITY_STYLES,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  MaterialOrder,
  Project,
  ProjectAccess,
  ProjectDocument,
  PunchItem,
  TradePhaseWithRelations,
} from "@/lib/database.types";

type ProjectTab = "overview" | "phases" | "materials" | "punch" | "documents";

interface TabOption {
  id: ProjectTab;
  label: string;
  count?: number;
}

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [trades, setTrades] = useState<TradeWithContractor[]>([]);
  const [phases, setPhases] = useState<TradePhaseWithRelations[]>([]);
  const [materials, setMaterials] = useState<MaterialOrder[]>([]);
  const [punchItems, setPunchItems] = useState<PunchItem[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectData, projectAccess] = await Promise.all([
        getProject(projectId),
        getMyProjectAccess(projectId),
      ]);
      setProject(projectData);
      setAccess(projectAccess);
      if (!projectData || !projectAccess) return;

      const [tradeData, phaseData, materialData, punchData, documentData] =
        await Promise.all([
          canUse(projectAccess, "can_view_trades", "can_edit_trades")
            ? listTrades(projectId)
            : Promise.resolve([]),
          canUse(projectAccess, "can_view_trade_phases", "can_edit_trade_phases")
            ? listTradePhases({ projectId })
            : Promise.resolve([]),
          canUse(projectAccess, "can_view_material_orders", "can_edit_material_orders")
            ? listMaterialOrders({ projectId })
            : Promise.resolve([]),
          canUse(projectAccess, "can_view_punch_items", "can_edit_punch_items")
            ? listAllPunchItems({ projectId })
            : Promise.resolve([]),
          canUse(projectAccess, "can_view_documents", "can_edit_documents")
            ? listDocuments({ projectId })
            : Promise.resolve([]),
        ]);
      setTrades(tradeData);
      setPhases(phaseData);
      setMaterials(materialData);
      setPunchItems(punchData);
      setDocuments(documentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs = useMemo<TabOption[]>(() => {
    const options: TabOption[] = [{ id: "overview", label: "Overview" }];
    if (!access) return options;
    if (canUse(access, "can_view_trade_phases", "can_edit_trade_phases")) {
      options.push({ id: "phases", label: "Trade phases", count: phases.length });
    }
    if (canUse(access, "can_view_material_orders", "can_edit_material_orders")) {
      options.push({ id: "materials", label: "Materials", count: materials.length });
    }
    if (canUse(access, "can_view_punch_items", "can_edit_punch_items")) {
      options.push({ id: "punch", label: "Punch list", count: punchItems.length });
    }
    if (canUse(access, "can_view_documents", "can_edit_documents")) {
      options.push({ id: "documents", label: "Documents", count: documents.length });
    }
    return options;
  }, [access, documents.length, materials.length, phases.length, punchItems.length]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) setActiveTab("overview");
  }, [activeTab, tabs]);

  if (loading) {
    return <PageContainer><LoadingState message="Loading project…" /></PageContainer>;
  }
  if (error) {
    return <PageContainer><ErrorAlert message={error} /></PageContainer>;
  }
  if (!project || !access) {
    return (
      <PageContainer>
        <EmptyState
          title="Project not found"
          description="This project may have been removed or you may no longer have access."
          action={<Link href="/projects"><Button variant="outline">Back to projects</Button></Link>}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={project.name}
        description={project.location ?? undefined}
        action={<Link href="/projects"><Button variant="outline">Back to projects</Button></Link>}
      />

      <div role="tablist" aria-label="Project workspace" className="mb-6 flex gap-1 overflow-x-auto border-b border-ink-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`project-panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium",
              activeTab === tab.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div id={`project-panel-${activeTab}`} role="tabpanel" aria-label={tabs.find((tab) => tab.id === activeTab)?.label}>
        {activeTab === "overview" && (
          <OverviewTab
            project={project}
            access={access}
            trades={trades}
            phases={phases}
            materials={materials}
            punchItems={punchItems}
            documents={documents}
            onSelectTab={setActiveTab}
          />
        )}
        {activeTab === "phases" && <TradePhasesTab project={project} access={access} phases={phases} />}
        {activeTab === "materials" && <MaterialsTab project={project} access={access} materials={materials} />}
        {activeTab === "punch" && <PunchTab project={project} punchItems={punchItems} phases={phases} />}
        {activeTab === "documents" && <DocumentsTab project={project} access={access} documents={documents} />}
      </div>
    </PageContainer>
  );
}

function OverviewTab({ project, access, trades, phases, materials, punchItems, documents, onSelectTab }: {
  project: Project;
  access: ProjectAccess;
  trades: TradeWithContractor[];
  phases: TradePhaseWithRelations[];
  materials: MaterialOrder[];
  punchItems: PunchItem[];
  documents: ProjectDocument[];
  onSelectTab: (tab: ProjectTab) => void;
}) {
  const openPunch = punchItems.filter((item) => item.status !== "Resolved" && item.status !== "Closed");
  const pendingReceipts = materials.filter((order) => order.status === "Pending Verification");
  const delayedMaterials = materials.filter((order) => order.status === "Delayed");
  const activePhases = phases.filter((phase) => phase.status !== "Approved" && phase.status !== "Completed");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric label="Active phases" value={activePhases.length} />
        <SummaryMetric label="Material orders" value={materials.length} />
        <SummaryMetric label="Open punch items" value={openPunch.length} />
        <SummaryMetric label="Documents" value={documents.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Project details</CardTitle></CardHeader>
          <CardBody className="space-y-3 text-sm">
            <DetailRow label="Start date" value={formatDate(project.start_date)} />
            <DetailRow label="Estimated end" value={formatDate(project.estimated_end_date)} />
            <DetailRow label="Trades" value={String(trades.length)} />
            <DetailRow label="Trade phases" value={String(phases.length)} />
            {project.notes && (
              <div className="pt-2">
                <p className="text-ink-500">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-ink-800">{project.notes}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Needs attention</CardTitle></CardHeader>
          <CardBody>
            {pendingReceipts.length === 0 && delayedMaterials.length === 0 && openPunch.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">Nothing needs immediate attention.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <AttentionButton label="Receipts to verify" value={pendingReceipts.length} onClick={() => onSelectTab("materials")} />
                <AttentionButton label="Delayed materials" value={delayedMaterials.length} onClick={() => onSelectTab("materials")} />
                <AttentionButton label="Open punch items" value={openPunch.length} onClick={() => onSelectTab("punch")} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {canUse(access, "can_view_documents", "can_edit_documents") && <PinnedPlansSection projectId={project.id} />}
      <ManageUsersSection projectId={project.id} projectName={project.name} />
    </div>
  );
}

function TradePhasesTab({ project, access, phases }: { project: Project; access: ProjectAccess; phases: TradePhaseWithRelations[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Trade phases</CardTitle>
        {access.can_edit_trade_phases && <Link href={`/trade-phases/new?projectId=${project.id}`}><Button size="sm">Add phase</Button></Link>}
      </CardHeader>
      <CardBody>
        {phases.length === 0 ? <EmptyMessage>No trade phases for this project yet.</EmptyMessage> : (
          <ul className="divide-y divide-ink-100">
            {phases.map((phase) => (
              <li key={phase.id}>
                <Link href={`/trade-phases/${phase.id}`} className="flex flex-col gap-2 py-4 hover:bg-ink-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{phase.title}</p>
                    <p className="text-sm text-ink-500">{phase.trade?.name ?? "No trade"}{phase.contractor ? ` · ${phase.contractor.company_name}` : " · Unassigned"}</p>
                    <p className="mt-1 text-xs text-ink-400">{formatDate(phase.scheduled_start_date)} → {formatDate(phase.scheduled_end_date)}</p>
                  </div>
                  <StatusBadge status={phase.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function MaterialsTab({ project, access, materials }: { project: Project; access: ProjectAccess; materials: MaterialOrder[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Material orders</CardTitle>
        {access.can_edit_material_orders && <Link href={`/material-orders/new?projectId=${project.id}`}><Button size="sm">Add material order</Button></Link>}
      </CardHeader>
      <CardBody>
        {materials.length === 0 ? <EmptyMessage>No material orders for this project yet.</EmptyMessage> : (
          <ul className="divide-y divide-ink-100">
            {materials.map((order) => (
              <li key={order.id}>
                <Link href={`/material-orders?materialId=${order.id}`} className="flex flex-col gap-2 py-4 hover:bg-ink-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{order.name}</p>
                    <p className="text-sm text-ink-500">{order.supplier ?? "No supplier"}</p>
                    <p className="mt-1 text-xs text-ink-400">Expected {formatDate(order.expected_arrival_date)}</p>
                  </div>
                  <span className={cn("inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium", MATERIAL_ORDER_STATUS_STYLES[order.status])}>{order.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function PunchTab({ project, punchItems, phases }: { project: Project; punchItems: PunchItem[]; phases: TradePhaseWithRelations[] }) {
  const phaseNames = new Map(phases.map((phase) => [phase.id, phase.title]));
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Punch list</CardTitle>
        <Link href={`/punch-items?projectId=${project.id}`}><Button size="sm" variant="outline">Open full punch list</Button></Link>
      </CardHeader>
      <CardBody>
        {punchItems.length === 0 ? <EmptyMessage>No punch items for this project yet.</EmptyMessage> : (
          <ul className="divide-y divide-ink-100">
            {punchItems.map((item) => (
              <li key={item.id} className="py-4">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">{item.title}</p>
                    <p className="text-sm text-ink-500">{phaseNames.get(item.trade_phase_id) ?? "Trade phase"}{item.due_date ? ` · Due ${formatDate(item.due_date)}` : ""}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PUNCH_PRIORITY_STYLES[item.priority])}>{item.priority}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PUNCH_ITEM_STATUS_STYLES[item.status])}>{item.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function DocumentsTab({ project, access, documents }: { project: Project; access: ProjectAccess; documents: ProjectDocument[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Documents</CardTitle>
        {access.can_edit_documents && <Link href={`/documents/new?projectId=${project.id}`}><Button size="sm">Upload document</Button></Link>}
      </CardHeader>
      <CardBody>
        {documents.length === 0 ? <EmptyMessage>No documents for this project yet.</EmptyMessage> : (
          <ul className="divide-y divide-ink-100">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <a href={document.file_url} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-ink-900 hover:underline">
                    {document.pinned ? "★ " : ""}{document.name}
                  </a>
                  <p className="text-xs text-ink-400">Uploaded {formatDate(document.created_at)}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", DOCUMENT_TYPE_STYLES[document.document_type])}>{document.document_type}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function canUse(
  access: ProjectAccess,
  viewField: keyof ProjectAccess,
  editField: keyof ProjectAccess,
): boolean {
  return access[viewField] === true || access[editField] === true;
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return <div className="border-b border-ink-200 py-3"><p className="text-2xl font-semibold text-ink-900">{value}</p><p className="text-sm text-ink-500">{label}</p></div>;
}

function AttentionButton({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={value === 0} className="border-l-2 border-amber-400 px-3 py-2 text-left disabled:border-ink-200 disabled:opacity-60">
      <span className="block text-xl font-semibold text-ink-900">{value}</span>
      <span className="text-sm text-ink-600">{label}</span>
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><span className="text-ink-500">{label}</span><span className="text-right font-medium text-ink-800">{value}</span></div>;
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-ink-500">{children}</p>;
}
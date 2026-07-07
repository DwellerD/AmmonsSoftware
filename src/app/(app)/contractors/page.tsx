"use client";

import { useEffect, useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import {
  EmptyState,
  ErrorAlert,
  LoadingState,
} from "@/components/ui/States";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  createContractor,
  deleteContractor,
  listContractors,
  updateContractor,
  type NewContractorInput,
  type UpdateContractorInput,
} from "@/lib/api";
import type { Contractor } from "@/lib/database.types";

interface ContractorFormValues {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  trade_specialty: string;
  notes: string;
}

/**
 * Contractors screen: view, create, edit, duplicate, and delete contractor
 * records used throughout scheduling and punch assignment.
 */
export default function ContractorsPage() {
  const { canManage } = useAuth();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setContractors(await listContractors());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load contractors.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const editingContractor =
    editingId != null
      ? contractors.find((c) => c.id === editingId) ?? null
      : null;

  async function handleDuplicate(contractor: Contractor) {
    setBusyId(contractor.id);
    setError(null);
    try {
      const payload: NewContractorInput = {
        company_name: `${contractor.company_name} (Copy)`,
        contact_name: contractor.contact_name ?? undefined,
        phone: contractor.phone ?? undefined,
        email: contractor.email ?? undefined,
        trade_specialty: contractor.trade_specialty ?? undefined,
        notes: contractor.notes ?? undefined,
      };
      await createContractor(payload);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to duplicate contractor.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Contractors"
        description="Companies and crews you assign to trade phases."
        action={
          canManage && !showCreateForm ? (
            <Button
              onClick={() => {
                setShowCreateForm(true);
                setEditingId(null);
              }}
            >
              New contractor
            </Button>
          ) : undefined
        }
      />

      {showCreateForm && (
        <ContractorForm
          mode="create"
          onCancel={() => setShowCreateForm(false)}
          onSubmit={async (values) => {
            const payload: NewContractorInput = {
              company_name: values.company_name,
              contact_name: values.contact_name || undefined,
              phone: values.phone || undefined,
              email: values.email || undefined,
              trade_specialty: values.trade_specialty || undefined,
              notes: values.notes || undefined,
            };
            await createContractor(payload);
            setShowCreateForm(false);
            await load();
          }}
        />
      )}

      {editingContractor && (
        <ContractorForm
          mode="edit"
          initialValues={{
            company_name: editingContractor.company_name,
            contact_name: editingContractor.contact_name ?? "",
            phone: editingContractor.phone ?? "",
            email: editingContractor.email ?? "",
            trade_specialty: editingContractor.trade_specialty ?? "",
            notes: editingContractor.notes ?? "",
          }}
          onCancel={() => setEditingId(null)}
          onSubmit={async (values) => {
            const payload: UpdateContractorInput = {
              company_name: values.company_name,
              contact_name: values.contact_name || undefined,
              phone: values.phone || undefined,
              email: values.email || undefined,
              trade_specialty: values.trade_specialty || undefined,
              notes: values.notes || undefined,
            };
            await updateContractor(editingContractor.id, payload);
            setEditingId(null);
            await load();
          }}
          onDelete={async () => {
            const confirmed = window.confirm(
              `Delete contractor "${editingContractor.company_name}"? This cannot be undone.`,
            );
            if (!confirmed) return;

            setBusyId(editingContractor.id);
            setError(null);
            try {
              await deleteContractor(editingContractor.id);
              setEditingId(null);
              await load();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Failed to delete contractor.",
              );
            } finally {
              setBusyId(null);
            }
          }}
        />
      )}

      {loading ? (
        <LoadingState message="Loading contractors…" />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : contractors.length === 0 ? (
        <EmptyState
          title="No contractors yet"
          description="Add the contractors and crews you work with."
          action={
            canManage ? (
              <Button
                onClick={() => {
                  setShowCreateForm(true);
                  setEditingId(null);
                }}
              >
                New contractor
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contractors.map((c) => (
            <Card key={c.id} className="h-full">
              <CardBody>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink-900">{c.company_name}</h3>
                  {c.trade_specialty && <Badge>{c.trade_specialty}</Badge>}
                </div>
                {c.contact_name && (
                  <p className="mt-2 text-sm text-ink-700">{c.contact_name}</p>
                )}
                <div className="mt-3 space-y-1 text-sm text-ink-500">
                  {c.phone && <p>{c.phone}</p>}
                  {c.email && <p className="truncate">{c.email}</p>}
                </div>
                {c.notes && (
                  <p className="mt-3 line-clamp-3 text-xs text-ink-500">{c.notes}</p>
                )}

                {canManage && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(c.id);
                        setShowCreateForm(false);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busyId === c.id}
                      onClick={() => handleDuplicate(c)}
                    >
                      Duplicate
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/** Reusable create/edit form for contractor records. */
function ContractorForm({
  mode,
  initialValues,
  onCancel,
  onSubmit,
  onDelete,
}: {
  mode: "create" | "edit";
  initialValues?: ContractorFormValues;
  onCancel: () => void;
  onSubmit: (values: ContractorFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [form, setForm] = useState<ContractorFormValues>(
    initialValues ?? {
      company_name: "",
      contact_name: "",
      phone: "",
      email: "",
      trade_specialty: "",
      notes: "",
    },
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ContractorFormValues>(
    key: K,
    value: ContractorFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) {
      setError("Company name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...form, company_name: form.company_name.trim() });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save contractor.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete contractor.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}

          <Field label="Company name" htmlFor={`${mode}-contractor-company`} required>
            <Input
              id={`${mode}-contractor-company`}
              value={form.company_name}
              onChange={(e) => update("company_name", e.target.value)}
              placeholder="Acme Framing Co."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name" htmlFor={`${mode}-contractor-contact`}>
              <Input
                id={`${mode}-contractor-contact`}
                value={form.contact_name}
                onChange={(e) => update("contact_name", e.target.value)}
                placeholder="Pat Rivera"
              />
            </Field>
            <Field label="Trade specialty" htmlFor={`${mode}-contractor-specialty`}>
              <Input
                id={`${mode}-contractor-specialty`}
                value={form.trade_specialty}
                onChange={(e) => update("trade_specialty", e.target.value)}
                placeholder="Framing"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor={`${mode}-contractor-phone`}>
              <Input
                id={`${mode}-contractor-phone`}
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </Field>
            <Field label="Email" htmlFor={`${mode}-contractor-email`}>
              <Input
                id={`${mode}-contractor-email`}
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="office@acmeframing.com"
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor={`${mode}-contractor-notes`}>
            <Textarea
              id={`${mode}-contractor-notes`}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Availability, rates, or other details."
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              {mode === "create" ? "Save contractor" : "Save changes"}
            </Button>
            {mode === "edit" && onDelete && (
              <Button
                type="button"
                variant="danger"
                loading={deleting}
                onClick={handleDelete}
              >
                Delete contractor
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

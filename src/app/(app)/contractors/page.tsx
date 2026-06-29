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
  listContractors,
  type NewContractorInput,
} from "@/lib/api";
import type { Contractor } from "@/lib/database.types";

/**
 * Contractors screen: view and create contractor records. Contractors can be
 * assigned to trade phases (and set as a trade's default contractor).
 */
export default function ContractorsPage() {
  const { canManage } = useAuth();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  return (
    <PageContainer>
      <PageHeader
        title="Contractors"
        description="Companies and crews you assign to trade phases."
        action={
          canManage && !showForm ? (
            <Button onClick={() => setShowForm(true)}>New contractor</Button>
          ) : undefined
        }
      />

      {showForm && (
        <ContractorForm
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
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
              <Button onClick={() => setShowForm(true)}>New contractor</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contractors.map((c) => (
            <Card key={c.id} className="h-full">
              <CardBody>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink-900">
                    {c.company_name}
                  </h3>
                  {c.trade_specialty && <Badge>{c.trade_specialty}</Badge>}
                </div>
                {c.contact_name && (
                  <p className="mt-2 text-sm text-ink-700">{c.contact_name}</p>
                )}
                <div className="mt-3 space-y-1 text-sm text-ink-500">
                  {c.phone && <p>{c.phone}</p>}
                  {c.email && <p className="truncate">{c.email}</p>}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/** Inline form for creating a contractor. */
function ContractorForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<NewContractorInput>({ company_name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof NewContractorInput>(
    key: K,
    value: NewContractorInput[K],
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
      await createContractor(form);
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save contractor.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}

          <Field label="Company name" htmlFor="company_name" required>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => update("company_name", e.target.value)}
              placeholder="Acme Framing Co."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name" htmlFor="contact_name">
              <Input
                id="contact_name"
                value={form.contact_name ?? ""}
                onChange={(e) => update("contact_name", e.target.value)}
                placeholder="Pat Rivera"
              />
            </Field>
            <Field label="Trade specialty" htmlFor="trade_specialty">
              <Input
                id="trade_specialty"
                value={form.trade_specialty ?? ""}
                onChange={(e) => update("trade_specialty", e.target.value)}
                placeholder="Framing"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone">
              <Input
                id="phone"
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
                placeholder="office@acmeframing.com"
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Availability, rates, or other details."
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              Save contractor
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

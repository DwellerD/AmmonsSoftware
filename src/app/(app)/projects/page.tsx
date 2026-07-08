"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import {
  EmptyState,
  ErrorAlert,
  LoadingState,
} from "@/components/ui/States";
import { useAuth } from "@/components/providers/AuthProvider";
import { createProject, listProjects, type NewProjectInput } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/database.types";

/**
 * Projects screen: list all projects, create a new one, and link to each
 * project's detail page. Demonstrates the loading / empty / error states the
 * rest of the app follows.
 */
export default function ProjectsPage() {
  const { canManage } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      setProjects(await listProjects());
      setError(null);
    } catch (err) {
      if (!background) {
        setError(err instanceof Error ? err.message : "Failed to load projects.");
      }
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    const intervalId = window.setInterval(() => {
      void load(true);
    }, 5000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [load]);

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description="Every build you are tracking in PhaseBinder."
        action={
          canManage && !showForm ? (
            <Button onClick={() => setShowForm(true)}>New project</Button>
          ) : undefined
        }
      />

      {showForm && (
        <ProjectForm
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      {loading ? (
        <LoadingState message="Loading projects…" />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start tracking trades and trade phases."
          action={
            canManage ? (
              <Button onClick={() => setShowForm(true)}>New project</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardBody>
                  <h3 className="font-semibold text-ink-900">{project.name}</h3>
                  {project.location && (
                    <p className="mt-1 text-sm text-ink-500">
                      {project.location}
                    </p>
                  )}
                  <div className="mt-4 flex justify-between text-xs text-ink-500">
                    <span>Start: {formatDate(project.start_date)}</span>
                    <span>End: {formatDate(project.estimated_end_date)}</span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

/** Inline form for creating a project. */
function ProjectForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<NewProjectInput>({ name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof NewProjectInput>(
    key: K,
    value: NewProjectInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Project name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createProject(form);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorAlert message={error} />}

          <Field label="Project name" htmlFor="name" required>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Maple Street Apartments"
            />
          </Field>

          <Field label="Location" htmlFor="location">
            <Input
              id="location"
              value={form.location ?? ""}
              onChange={(e) => update("location", e.target.value)}
              placeholder="123 Maple St, Springfield"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="start_date">
              <Input
                id="start_date"
                type="date"
                value={form.start_date ?? ""}
                onChange={(e) => update("start_date", e.target.value)}
              />
            </Field>
            <Field label="Estimated end date" htmlFor="estimated_end_date">
              <Input
                id="estimated_end_date"
                type="date"
                value={form.estimated_end_date ?? ""}
                onChange={(e) =>
                  update("estimated_end_date", e.target.value)
                }
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Anything the team should know about this project."
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              Save project
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

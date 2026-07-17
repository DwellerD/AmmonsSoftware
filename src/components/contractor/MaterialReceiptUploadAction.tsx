"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ErrorAlert, SuccessAlert } from "@/components/ui/States";
import {
  submitMaterialReceipt,
  uploadMaterialReceiptPhotos,
} from "@/lib/api";
import {
  MATERIAL_RECEIPT_MAX_FILE_BYTES,
  MATERIAL_RECEIPT_MAX_PHOTOS,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { ContractorActionLink } from "@/lib/database.types";

export function MaterialReceiptUploadAction({
  link,
}: {
  link: ContractorActionLink;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [previews]);

  function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const selected = Array.from(event.target.files ?? []);
    if (selected.length > MATERIAL_RECEIPT_MAX_PHOTOS) {
      setError(`Choose no more than ${MATERIAL_RECEIPT_MAX_PHOTOS} photos.`);
      event.target.value = "";
      return;
    }
    const invalid = selected.find(
      (file) =>
        !file.type.startsWith("image/") ||
        file.size > MATERIAL_RECEIPT_MAX_FILE_BYTES,
    );
    if (invalid) {
      setError("Each file must be an image no larger than 10 MB.");
      event.target.value = "";
      return;
    }
    previews.forEach((preview) => URL.revokeObjectURL(preview));
    setFiles(selected);
    setPreviews(selected.map((file) => URL.createObjectURL(file)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (files.length === 0) {
      setError("Add at least one delivery photo.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const photos = await uploadMaterialReceiptPhotos(link, files);
      await submitMaterialReceipt({
        link,
        uploaded_by_name: name,
        notes,
        photos,
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Receipt submission failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-3">
        <SuccessAlert message="Delivery photos submitted for GC verification." />
        <p className="text-sm text-ink-500">You can close this page now.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-lg border border-ink-100 bg-ink-50 p-4">
        <h1 className="text-lg font-semibold text-ink-900">
          Upload delivery photos
        </h1>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase text-ink-500">Material</dt>
            <dd className="font-medium text-ink-900">
              {link.material_name ?? "Material order"}
            </dd>
          </div>
          {link.supplier_name && (
            <div>
              <dt className="text-xs font-medium uppercase text-ink-500">Supplier</dt>
              <dd className="text-ink-800">{link.supplier_name}</dd>
            </div>
          )}
          {link.expected_arrival_date && (
            <div>
              <dt className="text-xs font-medium uppercase text-ink-500">Expected</dt>
              <dd className="text-ink-800">
                {formatDate(link.expected_arrival_date)}
              </dd>
            </div>
          )}
          {link.project_name && (
            <div>
              <dt className="text-xs font-medium uppercase text-ink-500">Project</dt>
              <dd className="text-ink-800">{link.project_name}</dd>
            </div>
          )}
        </dl>
      </div>

      {error && <ErrorAlert message={error} />}

      <Field label="Your name (optional)" htmlFor="receipt-name">
        <Input
          id="receipt-name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      <Field label="Notes (optional)" htmlFor="receipt-notes">
        <Textarea
          id="receipt-notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Damage, shortages, delivery location, or other details"
        />
      </Field>

      <Field label="Delivery photos" htmlFor="receipt-photos" required>
        <Input
          id="receipt-photos"
          type="file"
          accept="image/*"
          multiple
          onChange={selectFiles}
        />
        <p className="mt-1 text-xs text-ink-500">
          Up to {MATERIAL_RECEIPT_MAX_PHOTOS} images, 10 MB each.
        </p>
      </Field>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {previews.map((preview, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={preview}
              src={preview}
              alt={`Selected delivery photo ${index + 1}`}
              className="aspect-square w-full rounded-lg border border-ink-100 object-cover"
            />
          ))}
        </div>
      )}

      <Button type="submit" className="w-full" loading={saving}>
        Submit for verification
      </Button>
    </form>
  );
}

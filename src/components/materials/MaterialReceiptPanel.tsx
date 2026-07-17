"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorAlert, LoadingState, SuccessAlert } from "@/components/ui/States";
import {
  createMaterialReceiptUploadLink,
  listMaterialReceiptUploads,
  updateMaterialOrderStatus,
} from "@/lib/api";
import { buildActionLinkUrl } from "@/lib/actionLinks";
import { formatDate } from "@/lib/format";
import type {
  MaterialOrder,
  MaterialOrderStatus,
  MaterialReceiptUpload,
} from "@/lib/database.types";

export function MaterialReceiptPanel({
  order,
  canManage,
  onStatusChange,
}: {
  order: MaterialOrder;
  canManage: boolean;
  onStatusChange: (order: MaterialOrder) => void;
}) {
  const [receipts, setReceipts] = useState<MaterialReceiptUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState<MaterialOrderStatus | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listMaterialReceiptUploads(order.id)
      .then((loaded) => {
        if (active) setReceipts(loaded);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load receipts.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [order.id, order.latest_receipt_upload_id]);

  async function generateLink() {
    setGenerating(true);
    setError(null);
    setCopied(false);
    try {
      const link = await createMaterialReceiptUploadLink(order.id);
      setUrl(buildActionLinkUrl(window.location.origin, link.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate link.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  async function verify(status: Extract<MaterialOrderStatus, "Received" | "Issue Found">) {
    setVerifying(status);
    setError(null);
    try {
      const updated = await updateMaterialOrderStatus(order.id, status);
      onStatusChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(null);
    }
  }

  return (
    <section className="space-y-4 border-t border-ink-100 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink-900">Receipt verification</h3>
          <p className="text-sm text-ink-500">
            Generate a secure link to share manually with the person receiving the order.
          </p>
        </div>
        {canManage && !url && (
          <Button type="button" variant="outline" loading={generating} onClick={generateLink}>
            Generate upload link
          </Button>
        )}
      </div>

      {error && <ErrorAlert message={error} />}

      {url && (
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
          <label htmlFor="receipt-upload-link" className="text-xs font-medium text-ink-600">
            Secure receipt upload link
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="receipt-upload-link"
              readOnly
              value={url}
              className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800"
            />
            <Button type="button" size="sm" onClick={copyLink}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-1 text-xs text-ink-500">Expires after 14 days and can be used once.</p>
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading receipt submissions…" />
      ) : receipts.length === 0 ? (
        <p className="text-sm text-ink-500">No delivery photos submitted yet.</p>
      ) : (
        <div className="space-y-4">
          {order.status === "Pending Verification" && (
            <SuccessAlert message="Delivery photos are ready for GC verification." />
          )}
          {receipts.map((receipt) => (
            <article key={receipt.id} className="rounded-lg border border-ink-100 p-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <p className="font-medium text-ink-900">
                  {receipt.uploaded_by_name || "Unnamed receiver"}
                </p>
                <p className="text-xs text-ink-500">Submitted {formatDate(receipt.submitted_at)}</p>
              </div>
              {receipt.notes && <p className="mt-2 text-sm text-ink-700">{receipt.notes}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {receipt.photo_urls.map((photoUrl, index) => (
                  <a key={photoUrl} href={photoUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt={`Delivery receipt ${index + 1}`}
                      className="aspect-square w-full rounded-lg border border-ink-100 object-cover"
                    />
                  </a>
                ))}
              </div>
            </article>
          ))}

          {canManage && order.status === "Pending Verification" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                loading={verifying === "Received"}
                disabled={verifying !== null}
                onClick={() => verify("Received")}
              >
                Mark Received
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                loading={verifying === "Issue Found"}
                disabled={verifying !== null}
                onClick={() => verify("Issue Found")}
              >
                Mark Issue Found
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

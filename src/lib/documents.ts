import type { DocumentType } from "@/lib/database.types";

/**
 * Pure helper utilities for the Document Vault (no Firebase calls here).
 *
 * Keeping these small functions separate makes them easy to read and test, and
 * keeps the data layer (src/lib/api.ts) and UI components focused.
 */

/** Max upload size we accept for a project document (25 MB). */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/**
 * Guesses a sensible default document type from a file's name/MIME type.
 * The user can always override this in the upload form.
 */
export function inferDocumentType(file: File): DocumentType {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  if (mime.startsWith("image/")) {
    // Many blueprints are exported as images; default images to Photo and let
    // the user re-tag as Blueprint/Layout when relevant.
    return "Photo";
  }
  if (name.includes("invoice")) return "Invoice";
  if (name.includes("contract")) return "Contract";
  if (name.includes("change") && name.includes("order")) return "Change Order";
  if (name.includes("permit")) return "Permit";
  if (name.includes("layout")) return "Layout";
  if (
    name.includes("blueprint") ||
    name.includes("plan") ||
    name.endsWith(".dwg")
  ) {
    return "Blueprint";
  }
  return "Other";
}

/**
 * Turns a comma-separated tag string into a clean, de-duplicated array.
 * e.g. "foundation, Rebar, foundation" -> ["foundation", "rebar"].
 */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim().toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

/** Joins tags back into a comma-separated string for editing in a form. */
export function tagsToInput(tags: string[]): string {
  return tags.join(", ");
}

/** True when a download URL or filename looks like a viewable image. */
export function isImageFile(nameOrUrl: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(nameOrUrl);
}

/** Human-readable file size, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * Builds a predictable Storage path for a project document:
 *   documents/{projectId}/{timestamp}-{safeName}
 * The timestamp prefix keeps names unique without a database round-trip.
 */
export function buildDocumentStoragePath(
  projectId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^\w.\-]+/g, "_");
  return `documents/${projectId}/${Date.now()}-${safeName}`;
}

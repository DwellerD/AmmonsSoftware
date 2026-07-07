/**
 * In-memory file payloads for upload inputs.
 *
 * Using buffers (instead of committed binary fixtures) keeps the repo clean and
 * lets a test describe exactly what it is uploading right where it is used.
 */

/** A minimal valid 1x1 PNG, handy as a "completion photo". */
export function tinyPngFile(name = "completion-photo.png") {
  // 1x1 transparent PNG.
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  };
}

/** A small text-backed PDF stand-in, handy as a "blueprint" document. */
export function blueprintPdfFile(name = "blueprint.pdf") {
  const pdf =
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF";
  return {
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf, "utf8"),
  };
}

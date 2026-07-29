/**
 * Open a PDF that a server action fetched for us.
 *
 * The old path pointed `window.open` straight at the API origin
 * (`${API_URL}/invoices/:id/pdf`), which broke the "never call the API directly
 * from client components" rule and was the one request relying on a session
 * cookie crossing origins — so it 401s the moment the API is not same-site
 * (INV-34). The action fetches it with an explicit cookie header and returns
 * base64; this turns that back into something the browser can display.
 */

export interface PdfPayload {
  base64: string;
  filename: string;
}

/** Decode and open in a new tab. Revokes the object URL once the tab has it. */
export function openPdfPayload(payload: PdfPayload): void {
  const binary = atob(payload.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const opened = window.open(url, "_blank");

  if (!opened) {
    // Popup blocked — fall back to a download, which is never blocked.
    const link = document.createElement("a");
    link.href = url;
    link.download = payload.filename;
    link.click();
  }

  // Give the new tab a moment to take ownership before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

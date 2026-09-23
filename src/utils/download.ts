/**
 * Wrap the standard "make a data-url or blob and click a hidden <a>" download
 * pattern in a try/catch so browsers that block synthetic downloads (or run
 * out of memory building a giant blob) don't crash the caller.
 */

export type DownloadResult = { ok: true } | { ok: false; error: Error };

export function downloadBlob(filename: string, blob: Blob): DownloadResult {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Free the URL on the next tick so the browser had time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err as Error };
  }
}

export function downloadDataUrl(filename: string, url: string): DownloadResult {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err as Error };
  }
}

export function downloadJSON(filename: string, data: unknown): DownloadResult {
  try {
    const text = JSON.stringify(data, null, 2);
    return downloadBlob(filename, new Blob([text], { type: "application/json" }));
  } catch (err) {
    return { ok: false, error: err as Error };
  }
}

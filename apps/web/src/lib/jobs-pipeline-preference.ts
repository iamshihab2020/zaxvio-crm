"use client";

/**
 * Which pipeline the Jobs board was last on.
 *
 * Two readers, in different parts of the tree: the Jobs page (to restore the
 * board) and the sidebar (to build its Jobs link, so the link points at the
 * board you actually use rather than a bare `/jobs`). The sidebar lives in the
 * layout and does not remount on client navigation, so writing localStorage is
 * not enough on its own — it would only notice on a full page load. The custom
 * event is what closes that gap; the `storage` event does not, because the
 * browser only fires that in *other* tabs.
 */

export const JOBS_PIPELINE_STORAGE_KEY = "jobs-pipeline-id";
export const JOBS_PIPELINE_EVENT = "zaxvio:jobs-pipeline";

export function rememberJobsPipeline(pipelineId: string): void {
  try {
    localStorage.setItem(JOBS_PIPELINE_STORAGE_KEY, pipelineId);
  } catch {
    /* private mode — the link just falls back to /jobs */
  }
  window.dispatchEvent(
    new CustomEvent<string>(JOBS_PIPELINE_EVENT, { detail: pipelineId }),
  );
}

export function readJobsPipeline(): string | null {
  try {
    return localStorage.getItem(JOBS_PIPELINE_STORAGE_KEY);
  } catch {
    return null;
  }
}

import type { ReactNode } from "react";
import type { EntityType } from "@/hooks/use-view-preference";

export interface TabConfig {
  value: string;
  label: string;
  /** Optional count shown as a small badge next to the label */
  count?: number;
  content: ReactNode;
}

export interface EntityDetailShellProps {
  /** Entity type for view preference persistence */
  entityType: EntityType;
  /** Route prefix for "open full page" navigation, e.g. "/jobs" */
  entityRoute: string;
  /** Human label for sr-only aria text, e.g. "Job" */
  entityLabel: string;

  /** ID of the entity to display (null when nothing selected) */
  entityId: string | null;
  /** Controlled open/close state */
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Whether data is currently being fetched */
  loading: boolean;
  /** Whether entity data is available to render */
  hasData: boolean;
  /**
   * Why the fetch failed, when it did. Without this the shell rendered *nothing*
   * for `!loading && !hasData`, so a 500 opened an empty sheet — indistinguishable
   * from a job with no content. Shared by all four detail sheets.
   */
  loadError?: string | null;
  /** Retry handler shown alongside `loadError`. */
  onRetry?: () => void;

  /** Renders the entity title area (number, badges) — called only when hasData */
  renderTitle: () => ReactNode;
  /** Renders the subtitle/description — called only when hasData */
  renderDescription?: () => ReactNode;
  /** Renders entity-specific action buttons (Move to X, Send, etc.) — called only when hasData */
  renderActions?: () => ReactNode;

  /** Extra toolbar icons beyond the standard set (e.g., overflow menu) */
  renderToolbarExtras?: () => ReactNode;
  /** If provided, renders a delete icon button in the toolbar */
  onDelete?: () => void;

  /** Tab configuration — if provided, renders tabbed content. Mutually exclusive with children */
  tabs?: TabConfig[];
  /** Direct content for non-tabbed entities (e.g., bookings). Mutually exclusive with tabs */
  children?: ReactNode;
}

export type { EntityType };

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";

interface WidgetErrorBoundaryProps {
  /** Shown in the fallback so the user knows which card failed. */
  name: string;
  /** Reassurance line. Defaults to the dashboard wording. */
  hint?: string;
  children: ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
}

/**
 * Isolates a single widget's render failure.
 *
 * Without this, one card throwing (a malformed chart row, an unexpected null)
 * unmounts the entire page and the user sees a blank screen instead of the
 * cards that rendered fine. Class component because React has no hook form of
 * an error boundary.
 *
 * Shared by /dashboard and /reports.
 */
export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  state: WidgetErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`widget "${this.props.name}" failed to render`, error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 p-6 text-center">
        <IconAlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
        <p className="mt-2 font-heading text-sm font-semibold text-foreground">
          {this.props.name} couldn&apos;t load
        </p>
        <p className="mt-1 text-xs font-body text-muted-foreground">
          {this.props.hint ??
            "The rest of this page is unaffected. Try refreshing."}
        </p>
      </div>
    );
  }
}

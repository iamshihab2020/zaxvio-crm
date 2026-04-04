"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useViewPreference, type EntityType } from "@/hooks/use-view-preference";

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 400;
const MAX_WIDTH = 800;

export function useDetailShell(
  entityType: EntityType,
  entityRoute: string,
  onOpenChange: (open: boolean) => void,
) {
  const router = useRouter();
  const {
    mode: prefMode,
    sidebarWidth: prefSidebarWidth,
    mounted,
    setMode: setPrefMode,
    setSidebarWidth: setPrefSidebarWidth,
  } = useViewPreference(entityType);

  const [liveSidebarWidth, setLiveSidebarWidth] = useState(DEFAULT_WIDTH);
  const switchingModeRef = useRef(false);

  useEffect(() => {
    setLiveSidebarWidth(prefSidebarWidth);
  }, [prefSidebarWidth]);

  // Derive mode — if "page" preference, fall back to "sidebar" for panel rendering
  const mode = mounted
    ? prefMode === "page"
      ? "sidebar"
      : prefMode
    : "sidebar";

  /* ── Mode toggle ──────────────────────────────────────────── */
  const toggleMode = useCallback(() => {
    switchingModeRef.current = true;
    const newMode = prefMode === "sidebar" ? "dialog" : "sidebar";
    setPrefMode(newMode);
    requestAnimationFrame(() => {
      switchingModeRef.current = false;
    });
  }, [prefMode, setPrefMode]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (switchingModeRef.current) return;
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  /* ── Navigate to full page ────────────────────────────────── */
  const navigateToFullPage = useCallback(
    (entityId: string) => {
      setPrefMode("page");
      onOpenChange(false);
      router.push(`${entityRoute}/${entityId}`);
    },
    [setPrefMode, onOpenChange, router, entityRoute],
  );

  /* ── Drag-to-resize (sidebar only) ────────────────────────── */
  const dragWidthRef = useRef(DEFAULT_WIDTH);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragWidthRef.current = liveSidebarWidth;

      const onMove = (ev: MouseEvent) => {
        const w = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, window.innerWidth - ev.clientX),
        );
        dragWidthRef.current = w;
        setLiveSidebarWidth(w);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setPrefSidebarWidth(dragWidthRef.current);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [liveSidebarWidth, setPrefSidebarWidth],
  );

  return {
    mode,
    mounted,
    liveSidebarWidth,
    toggleMode,
    handleOpenChange,
    handleDragStart,
    navigateToFullPage,
  };
}

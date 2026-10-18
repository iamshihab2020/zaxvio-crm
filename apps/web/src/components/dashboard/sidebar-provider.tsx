"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type SidebarMode = "hover-expand" | "icon-tooltip";

interface SidebarState {
  isCollapsed: boolean;
  mode: SidebarMode;
  isHoverExpanded: boolean;
  /**
   * False until the saved collapsed state has been applied and painted. The
   * shell's width and offset transitions are only switched on after that, so a
   * reader who keeps the rail collapsed does not watch it close on every page
   * load; the transition is for clicking the toggle.
   */
  animated: boolean;
  toggleCollapsed: () => void;
  setMode: (mode: SidebarMode) => void;
  setHoverExpanded: (expanded: boolean) => void;
}

const STORAGE_KEY = "zaxvio-sidebar";

const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

interface PersistedState {
  isCollapsed: boolean;
  mode: SidebarMode;
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (
        typeof parsed.isCollapsed === "boolean" &&
        (parsed.mode === "hover-expand" || parsed.mode === "icon-tooltip")
      ) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { isCollapsed: false, mode: "hover-expand" };
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mode, setModeState] = useState<SidebarMode>("hover-expand");
  const [isHoverExpanded, setHoverExpanded] = useState(false);
  const [animated, setAnimated] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const saved = loadPersistedState();
    setIsCollapsed(saved.isCollapsed);
    setModeState(saved.mode);
    setMounted(true);
  }, []);

  // The saved state lands one render after the server's expanded default, so a
  // collapsed rail would otherwise animate shut on every full page load. Wait
  // two frames, enough for the collapsed layout to be painted, before the
  // shell's width and offset transitions exist; from then on the toggle animates.
  useEffect(() => {
    if (!mounted) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setAnimated(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [mounted]);

  // Persist to localStorage on change
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ isCollapsed, mode }));
  }, [isCollapsed, mode, mounted]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
    setHoverExpanded(false);
  }, []);

  const setMode = useCallback((newMode: SidebarMode) => {
    setModeState(newMode);
  }, []);

  // Before mount, render with default (expanded) to match SSR
  // After mount, render with real state
  const value: SidebarState = {
    isCollapsed: mounted ? isCollapsed : false,
    mode: mounted ? mode : "hover-expand",
    isHoverExpanded: mounted ? isHoverExpanded : false,
    animated,
    toggleCollapsed,
    setMode,
    setHoverExpanded,
  };

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

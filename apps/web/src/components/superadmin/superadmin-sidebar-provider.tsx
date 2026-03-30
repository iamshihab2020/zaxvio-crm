"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface SuperadminSidebarState {
  isCollapsed: boolean;
  isHoverExpanded: boolean;
  toggleCollapsed: () => void;
  setHoverExpanded: (expanded: boolean) => void;
}

const STORAGE_KEY = "zaxvio-admin-sidebar";

const SuperadminSidebarContext = createContext<SuperadminSidebarState | null>(null);

export function useSuperadminSidebar() {
  const ctx = useContext(SuperadminSidebarContext);
  if (!ctx)
    throw new Error(
      "useSuperadminSidebar must be used within SuperadminSidebarProvider",
    );
  return ctx;
}

export function SuperadminSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHoverExpanded, setHoverExpanded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.isCollapsed === "boolean") {
          setIsCollapsed(parsed.isCollapsed);
        }
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ isCollapsed }));
  }, [isCollapsed, mounted]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
    setHoverExpanded(false);
  }, []);

  const value: SuperadminSidebarState = {
    isCollapsed: mounted ? isCollapsed : false,
    isHoverExpanded: mounted ? isHoverExpanded : false,
    toggleCollapsed,
    setHoverExpanded,
  };

  return (
    <SuperadminSidebarContext.Provider value={value}>
      {children}
    </SuperadminSidebarContext.Provider>
  );
}

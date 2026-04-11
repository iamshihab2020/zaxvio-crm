"use client";

import { useState, useCallback, useMemo } from "react";

interface UseRowSelectionReturn {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: (items: { id: string }[]) => void;
  clearSelection: () => void;
  isAllSelected: (items: { id: string }[]) => boolean;
  isIndeterminate: (items: { id: string }[]) => boolean;
  selectedCount: number;
}

export function useRowSelection(): UseRowSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((items: { id: string }[]) => {
    setSelectedIds((prev) => {
      const allSelected = items.length > 0 && items.every((item) => prev.has(item.id));
      if (allSelected) {
        // Deselect all visible items (keep selections from other pages)
        const next = new Set(prev);
        for (const item of items) {
          next.delete(item.id);
        }
        return next;
      } else {
        // Select all visible items
        const next = new Set(prev);
        for (const item of items) {
          next.add(item.id);
        }
        return next;
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useCallback(
    (items: { id: string }[]) =>
      items.length > 0 && items.every((item) => selectedIds.has(item.id)),
    [selectedIds],
  );

  const isIndeterminate = useCallback(
    (items: { id: string }[]) => {
      if (items.length === 0) return false;
      const someSelected = items.some((item) => selectedIds.has(item.id));
      const allSelected = items.every((item) => selectedIds.has(item.id));
      return someSelected && !allSelected;
    },
    [selectedIds],
  );

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  return {
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    selectedCount,
  };
}

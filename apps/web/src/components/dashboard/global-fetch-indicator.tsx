"use client";

import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/**
 * Thin indeterminate progress bar shown at the very top of the viewport
 * whenever TanStack Query has background refetches in flight.
 *
 * - 300ms delay before showing (avoids flash on fast fetches)
 * - Only appears for background refetches (not initial loads)
 */
export function GlobalFetchIndicator() {
  const isFetching = useIsFetching();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isFetching > 0) {
      const timer = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [isFetching]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed left-0 right-0 top-0 z-[60] h-0.5 overflow-hidden bg-brand/20"
        >
          <motion.div
            className="h-full w-1/3 bg-brand"
            animate={{ x: ["-100%", "400%"] }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

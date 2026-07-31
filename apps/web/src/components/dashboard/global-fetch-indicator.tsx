"use client";

import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/**
 * Thin indeterminate progress bar shown at the top of the viewport while a
 * background refetch the reader is actually waiting on is in flight.
 *
 * Two things previously kept it on screen almost permanently:
 *
 *  - `useUnreadNotificationCount()` polls every 30 seconds, and the bell is
 *    mounted in the dashboard navbar, so it runs on every page. A silent
 *    background poll nobody asked for should not drive a global progress
 *    affordance, so polling keys are excluded outright.
 *
 *  - The 300ms grace period was meant to hide quick fetches, but every request
 *    here crosses browser → Vercel server action → Render → Neon. Measured
 *    against production, even `/health` — which touches no database — takes
 *    300-960ms, so nothing ever finished inside the window and the bar showed
 *    for literally every request.
 */

/** Query key prefixes whose fetches are background noise, not user-visible work. */
const SILENT_PREFIXES: readonly string[] = ["notifications"];

const SHOW_AFTER_MS = 800;

export function GlobalFetchIndicator() {
  const isFetching = useIsFetching({
    predicate: (query) => {
      const [prefix] = query.queryKey;
      return typeof prefix === "string"
        ? !SILENT_PREFIXES.includes(prefix)
        : true;
    },
  });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isFetching > 0) {
      const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
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

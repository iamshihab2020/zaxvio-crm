"use client";

import { useEffect, useState } from "react";

interface ElapsedTimeProps {
  /** ISO instant the clock started. */
  since: string;
  className?: string;
}

function format(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * A live counter, ticking once a second.
 *
 * ## Why it starts empty
 *
 * The elapsed time is different on the server than in the browser by definition,
 * so rendering it during SSR is a guaranteed hydration mismatch. Mounting first
 * and computing after is the fix, and the empty first frame is one tick long.
 *
 * ## Why the interval is real rather than derived from a render
 *
 * Nothing else re-renders while a timer runs — the user may be reading a page
 * with no queries in flight for an hour. Without its own interval the counter
 * would freeze at whatever it said when the page last had a reason to paint,
 * which reads as a stopped clock.
 */
export function ElapsedTime({ since, className }: ElapsedTimeProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return <span className={className} />;

  const started = new Date(since).getTime();
  if (Number.isNaN(started)) return <span className={className} />;

  return (
    <span className={className} suppressHydrationWarning>
      {format(now - started)}
    </span>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  /** Stagger, in milliseconds, applied as a CSS transition-delay. */
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}

/**
 * Scroll-triggered reveal.
 *
 * Replaces the framer-motion `Fade` the landing page used to wrap every card
 * in. Two reasons it is worth the swap:
 *
 *  - `Fade` mounted a motion component per card, so a marketing page shipped a
 *    full animation runtime to fade some text in.
 *  - Its hidden state lived in the React tree, so a slow or failed bundle left
 *    the whole page rendered at opacity 0. Here the hidden state is CSS scoped
 *    to `html.js` (see globals.css), which fails open.
 *
 * `reveal-ready` is added one frame after mount so an element already in the
 * viewport on load does not animate its own initial paint.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const frame = requestAnimationFrame(() => setReady(true));

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>}
      className={cn("reveal", ready && "reveal-ready", visible && "is-visible", className)}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

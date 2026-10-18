"use client";

import * as React from "react";

import {
  Tabs as AnimatedTabs,
  TabsList as AnimatedTabsList,
  TabsHighlight,
  TabsHighlightItem,
  TabsTrigger as AnimatedTabsTrigger,
  TabsContent as AnimatedTabsContent,
  TabsContents as AnimatedTabsContents,
  type TabsProps as AnimatedTabsProps,
  type TabsListProps as AnimatedTabsListProps,
  type TabsTriggerProps as AnimatedTabsTriggerProps,
  type TabsContentProps as AnimatedTabsContentProps,
  type TabsContentsProps as AnimatedTabsContentsProps,
} from "@/components/animate-ui/primitives/radix/tabs";
import { cn } from "@/lib/utils";
import { DUR, EASE_OUT } from "@/lib/motion";

// ── Tabs Root ──

type TabsProps = AnimatedTabsProps;

function Tabs({ className, ...props }: TabsProps) {
  return <AnimatedTabs className={cn("flex flex-col", className)} {...props} />;
}

// ── Tabs List (with animated underline indicator) ──

type TabsListProps = AnimatedTabsListProps & {
  className?: string;
};

// The underline is brand-ink, not brand: it is the selected state's main cue,
// so it needs 3:1 (WCAG 1.4.11). Bright brand was 2.56:1 on surface-alt (LAND-22).
//
// The list scrolls sideways instead of clipping, so six or more tabs survive a
// 375px screen. The underline lives inside each trigger's wrapper, not against
// the list, so scrolling doesn't detach it. The scrollbar is hidden because a
// half-cut next tab already says "more this way". There is deliberately no
// `max-w-full`: the Tabs root is a flex column that already stretches the list
// to its width, and the landing page's `w-max` strip sits in its own scroller,
// which has to keep seeing the list's full width.
//
// `min-h-10` rather than `h-10`: with `overflow-y-hidden` a fixed height would
// clip the underline of a 40px phone trigger by the pixel the border takes, so
// the list grows to fit instead.
function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsHighlight
      className="bg-brand-ink rounded-full"
      style={{ inset: "auto 0 0 0", height: "2px" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <AnimatedTabsList
        className={cn(
          "inline-flex min-h-10 items-center justify-start gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-border bg-transparent p-0",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
        {...props}
      />
    </TabsHighlight>
  );
}

// ── Tabs Trigger (with highlight item for animated tracking) ──

type TabsTriggerProps = AnimatedTabsTriggerProps;

// The wrapper is the flex item, so `flex-shrink-0` lives there: it is what keeps
// a tab from squeezing below its label in the scrolling list. The focus ring is
// inset because the list clips overflow, and an outer ring would be cut off at
// the list's edges. `min-h-10` is the phone touch target; from `sm` it drops
// back to the dense size.
function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  return (
    <TabsHighlightItem value={value} className="relative flex-shrink-0">
      <AnimatedTabsTrigger
        value={value}
        className={cn(
          "relative z-10 inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm font-medium font-body text-muted-foreground transition-colors sm:min-h-0",
          "hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          "data-[state=active]:text-foreground",
          className,
        )}
        {...props}
      />
    </TabsHighlightItem>
  );
}

// ── Tabs Content (fades in and rises when it becomes the active panel) ──

type TabsContentProps = AnimatedTabsContentProps;

// A panel arrives when you switch to it: opacity 0 to 1 and 4px up, 200ms on
// the system curve (`--dur-state`, `--ease-out`). It does not arrive with the
// page. The animate-ui primitive renders its `initial` style (opacity 0, blur)
// into the server HTML and then animates after hydration, so the first panel
// sat invisible until the script ran, and it left `filter: blur(0px)` behind,
// which makes the panel the containing block for any `position: fixed` child.
//
// `initial={false}` until the first effect has run renders the panel at rest on
// the server and on hydration. Every TabsContent mounts with the page, so by
// the time anyone can click a tab `armed` is already true; a panel that mounts
// after that (Radix mounts a panel when its tab becomes active) starts from
// the hidden state and animates. The panel that was active at load is already
// mounted, so changing the prop later does nothing to it. Opacity and the rise
// are the only things animated; reduced motion (MotionConfig) keeps the fade
// and drops the rise.
//
// The underline and the scrolling list are TabsList's and are not touched here.
function TabsContent({ className, ...props }: TabsContentProps) {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    setArmed(true);
  }, []);

  return (
    <AnimatedTabsContent
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      initial={armed ? { opacity: 0, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.state / 1000, ease: EASE_OUT }}
      {...props}
    />
  );
}

// ── Tabs Contents (animated height wrapper) ──

type TabsContentsProps = AnimatedTabsContentsProps;

function TabsContents(props: TabsContentsProps) {
  return <AnimatedTabsContents {...props} />;
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContents,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
  type TabsContentsProps,
};

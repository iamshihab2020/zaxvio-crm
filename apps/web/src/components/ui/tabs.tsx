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

// ── Tabs Root ──

type TabsProps = AnimatedTabsProps;

function Tabs({ className, ...props }: TabsProps) {
  return <AnimatedTabs className={cn("flex flex-col", className)} {...props} />;
}

// ── Tabs List (with animated underline indicator) ──

type TabsListProps = AnimatedTabsListProps & {
  className?: string;
};

function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsHighlight
      className="bg-brand rounded-full"
      style={{ inset: "auto 0 0 0", height: "2px" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      controlledItems
      click={false}
    >
      <AnimatedTabsList
        className={cn(
          "inline-flex h-10 items-center justify-start gap-1 border-b border-border bg-transparent p-0",
          className,
        )}
        {...props}
      />
    </TabsHighlight>
  );
}

// ── Tabs Trigger (with highlight item for animated tracking) ──

type TabsTriggerProps = AnimatedTabsTriggerProps;

function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  return (
    <TabsHighlightItem value={value} className="relative flex-shrink-0">
      <AnimatedTabsTrigger
        value={value}
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm font-medium font-body text-muted-foreground ring-offset-background transition-colors",
          "hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "data-[state=active]:text-foreground",
          className,
        )}
        {...props}
      />
    </TabsHighlightItem>
  );
}

// ── Tabs Content (with fade animation) ──

type TabsContentProps = AnimatedTabsContentProps;

function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <AnimatedTabsContent
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      transition={{ duration: 0.3, ease: "easeInOut" }}
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

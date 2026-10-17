"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { IconCheck } from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer relative h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      // Below `md` the box keeps its 16px look but takes a 40px tap: it is the
      // only target in every list table's select column, and a 16px square is
      // a miss on a phone. The pseudo-element is transparent and inside the
      // button, so a tap on it is a tap on the checkbox.
      "max-md:before:absolute max-md:before:-inset-3 max-md:before:content-['']",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator asChild>
      <AnimatePresence mode="wait">
        <motion.span
          className="flex items-center justify-center text-current"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <IconCheck className="h-3.5 w-3.5" />
        </motion.span>
      </AnimatePresence>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };

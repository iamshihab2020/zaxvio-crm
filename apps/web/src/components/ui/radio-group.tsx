"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    className={cn("grid gap-2", className)}
    {...props}
    ref={ref}
  />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "group/radio aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow transition-[border-color,box-shadow] duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {/* The dot is always rendered and the item's own `data-state` scales it in
        and out. Mounting it from a Radix Indicator instead would replay the
        entrance for a radio that is already checked when the form first
        appears; a transition only runs on a change. */}
    <span className="flex items-center justify-center">
      <span className="h-2 w-2 scale-0 rounded-full bg-primary opacity-0 transition-[transform,opacity] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-data-[state=checked]/radio:scale-100 group-data-[state=checked]/radio:opacity-100 motion-reduce:transition-none" />
    </span>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };

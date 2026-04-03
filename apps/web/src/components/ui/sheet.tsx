"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";
import {
  AnimatePresence,
  motion,
  type Transition,
} from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

// ── Animated Overlay ──

function SheetOverlay({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay asChild {...props}>
      <motion.div
        className={cn("fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]", className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      />
    </SheetPrimitive.Overlay>
  );
}
SheetOverlay.displayName = "SheetOverlay";

// ── Side variants (for static classes only — animation handled by motion) ──

const sheetStaticVariants = cva(
  "fixed z-50 gap-4 bg-background shadow-2xl",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b",
        bottom: "inset-x-0 bottom-0 border-t",
        left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-lg",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

// ── Motion variants per side ──

const slideVariants = {
  top: { initial: { y: "-100%" }, animate: { y: 0 }, exit: { y: "-100%" } },
  bottom: { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } },
  left: { initial: { x: "-100%" }, animate: { x: 0 }, exit: { x: "-100%" } },
  right: { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } },
} as const;

const springTransition: Transition = {
  type: "spring",
  stiffness: 150,
  damping: 22,
};

// ── Animated Content ──

interface SheetContentProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>, "asChild" | "forceMount">,
    VariantProps<typeof sheetStaticVariants> {
  transition?: Transition;
  showCloseButton?: boolean;
}

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({
  side = "right",
  className,
  children,
  transition = springTransition,
  showCloseButton = false,
  ...props
}, ref) => {
  const variants = slideVariants[side ?? "right"];

  return (
    <SheetPortal>
      <AnimatePresence mode="wait">
        <SheetOverlay />
        <SheetPrimitive.Content ref={ref} asChild {...props}>
          <motion.div
            className={cn(sheetStaticVariants({ side }), className)}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={transition}
          >
            {children}
            {showCloseButton && (
              <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                <IconX className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </SheetPrimitive.Close>
            )}
          </motion.div>
        </SheetPrimitive.Content>
      </AnimatePresence>
    </SheetPortal>
  );
});
SheetContent.displayName = "SheetContent";

// ── Layout components (unchanged) ──

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};

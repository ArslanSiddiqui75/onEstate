"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

/**
 * Full-bleed sticky bar for a page's TabsList. Pins to the top of the
 * nearest scrolling ancestor (the shell's <main>) so the tab switcher stays
 * reachable while its content scrolls underneath. Negative margins cancel
 * out the shell's own padding so the bar's background spans edge-to-edge.
 */
export const TabsBar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "sticky -top-4 sm:-top-6 lg:-top-8 z-20 -mx-4 mb-5 border-b border-[var(--border)] bg-[var(--surface)]/92 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
      className,
    )}
    {...props}
  >
    {children}
  </div>
));
TabsBar.displayName = "TabsBar";

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex w-full flex-wrap items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-1",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--muted)] outline-none transition-colors duration-200 sm:px-4",
      "hover:text-[var(--foreground)]",
      "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
      "data-[state=active]:bg-[var(--surface-elevated)] data-[state=active]:text-[var(--foreground)] data-[state=active]:shadow-[0_1px_2px_rgba(20,17,15,0.08)]",
      className,
    )}
    {...props}
  >
    {children}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "outline-none data-[state=inactive]:hidden",
      "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-300",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

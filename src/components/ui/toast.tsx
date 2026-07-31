"use client";

/**
 * Toast Notification System
 * 
 * HOW THIS WORKS (for learning):
 * 
 * 1. We keep a list of "toasts" in React state (think of it as an array of messages)
 * 2. The <ToastContainer /> component renders that list as animated popups
 * 3. The toast() function lets ANY part of the app add a message to that list
 * 4. Each toast auto-removes itself after a few seconds
 * 
 * WHY "use client"?
 * Next.js has two types of components:
 *   - Server Components (default) — rendered on the server, can't use useState/useEffect
 *   - Client Components ("use client") — rendered in the browser, CAN use interactivity
 * Since toasts need animation and timers, they must be a Client Component.
 */

import * as React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
// TypeScript "types" describe the SHAPE of data. This says:
// "A toast has an id, a message, a tone (success/error/etc), and optional settings"

type ToastTone = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  /** How long (in ms) the toast stays visible. Default = 4000 (4 seconds) */
  duration?: number;
}

// ─── Icons & Colors ──────────────────────────────────────────────────────────
// Maps each toast "tone" to an icon and color scheme.

const TOAST_CONFIG: Record<
  ToastTone,
  { Icon: typeof Info; wrapClass: string; iconClass: string }
> = {
  success: {
    Icon: CheckCircle2,
    wrapClass:
      "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
    iconClass: "text-[var(--success)]",
  },
  error: {
    Icon: XCircle,
    wrapClass:
      "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
    iconClass: "text-[var(--danger)]",
  },
  warning: {
    Icon: AlertTriangle,
    wrapClass:
      "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
    iconClass: "text-[var(--warning)]",
  },
  info: {
    Icon: Info,
    wrapClass:
      "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--foreground)]",
    iconClass: "text-[var(--muted)]",
  },
};

// ─── Toast Store ─────────────────────────────────────────────────────────────
// This is a simple "pub/sub" pattern:
//   - `listeners` is a list of functions that want to know when toasts change
//   - `subscribe(fn)` adds a listener
//   - `notify()` calls all listeners with the current toasts
//   - `addToast()` adds a new toast and schedules its removal
//
// WHY NOT just use React context?
// Because we want to call `toast.success("Saved!")` from ANYWHERE — even from
// non-React code like API utility functions. This store lives outside React.

let toasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

function notify() {
  // Tell every listener "hey, the toasts changed!"
  listeners.forEach((fn) => fn([...toasts]));
}

function subscribe(fn: (toasts: Toast[]) => void) {
  listeners.push(fn);
  // Return an "unsubscribe" function (cleanup when component unmounts)
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function addToast(message: string, tone: ToastTone, duration = 4000) {
  // Create a unique ID using the current timestamp + a random number
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newToast: Toast = { id, message, tone, duration };

  toasts = [...toasts, newToast];
  notify();

  // Auto-remove after `duration` milliseconds
  setTimeout(() => {
    removeToast(id);
  }, duration);

  return id;
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

// ─── Public API ──────────────────────────────────────────────────────────────
// This is what you import and call from your code:
//   import { toast } from "@/components/ui/toast";
//   toast.success("Lead saved!");
//   toast.error("Something went wrong");

export const toast = {
  success: (message: string, duration?: number) =>
    addToast(message, "success", duration),
  error: (message: string, duration?: number) =>
    addToast(message, "error", duration),
  warning: (message: string, duration?: number) =>
    addToast(message, "warning", duration),
  info: (message: string, duration?: number) =>
    addToast(message, "info", duration),
};

// ─── Toast Item Component ────────────────────────────────────────────────────
// Renders a single toast notification with an icon, message, and close button.

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const config = TOAST_CONFIG[t.tone];
  const Icon = config.Icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        // Layout
        "pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius-sm)] border px-3.5 py-3",
        // Shadow & backdrop
        "shadow-[var(--shadow-float)] backdrop-blur-xl",
        // Animation: slide up + fade in
        "animate-[toast-in_0.3s_var(--ease-out-expo)_forwards]",
        // Max width so it doesn't stretch across the whole screen
        "max-w-sm w-full",
        // Tone-specific colors
        config.wrapClass,
      )}
    >
      <Icon
        className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconClass)}
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-sm font-medium">{t.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(t.id)}
        className="shrink-0 rounded-md p-0.5 opacity-60 transition hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Toast Container ─────────────────────────────────────────────────────────
// Place this ONCE in your root layout. It renders all active toasts in a fixed
// position at the bottom-right of the screen.
//
// IMPORTANT: This component uses `useSyncExternalStore` — a React hook designed
// exactly for subscribing to external (non-React) data stores. It's the "right"
// way to connect our toast store to React.

export function ToastContainer() {
  const currentToasts = React.useSyncExternalStore(
    subscribe,
    () => toasts,
    () => [], // Server-side: no toasts
  );

  if (currentToasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
    >
      {currentToasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
      ))}
    </div>
  );
}

"use client";

/**
 * Error Boundary Component
 *
 * HOW THIS WORKS (for learning):
 *
 * In React, if a component crashes (throws an error), it normally takes down
 * the ENTIRE page — you just see a white screen. That's terrible UX.
 *
 * An "Error Boundary" is a special component that wraps around other components
 * and catches their errors. Instead of a white screen, it shows a friendly
 * message with a "Try again" button.
 *
 * IMPORTANT: Error boundaries MUST be class components (not function components).
 * This is one of the very few cases where React still requires a class.
 * The static method `getDerivedStateFromError` is what React calls when a
 * child component throws an error.
 *
 * USAGE:
 *   <ErrorBoundary>
 *     <YourComponent />     ← if this crashes, ErrorBoundary catches it
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Custom error UI</p>}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom UI to show when an error is caught */
  fallback?: React.ReactNode;
  /** Optional callback when an error is caught (e.g., for logging) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Optional className for the error card */
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ─── Error Boundary Class Component ──────────────────────────────────────────

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    // Initial state: no error
    this.state = { hasError: false, error: null };
  }

  /**
   * React calls this when a child component throws.
   * We return new state that says "yes, there's an error".
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * React also calls this after catching an error.
   * Good place to log the error to a service (like Sentry).
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    // Call the optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Reset the error state so the user can try again.
   * This re-renders the children as if the error never happened.
   */
  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback was provided, use that
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Otherwise, show our default error UI
      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-4 rounded-[var(--radius-md)] border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-8 text-center",
            this.props.className,
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-soft)]">
            <AlertTriangle className="h-6 w-6 text-[var(--danger)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--foreground)]">
              Something went wrong
            </h3>
            <p className="mt-1 max-w-md text-sm text-[var(--muted)]">
              {this.state.error?.message ||
                "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-muted)]"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      );
    }

    // No error? Render children normally
    return this.props.children;
  }
}

"use client";

/**
 * Form Field Component
 *
 * HOW THIS WORKS (for learning):
 *
 * When you have a form with validation, each input field might have an error.
 * Instead of manually adding error text below every input, this component
 * wraps an input and AUTOMATICALLY shows the error message below it.
 *
 * It also:
 * - Adds a label above the input
 * - Highlights the input border in red when there's an error
 * - Uses proper HTML `<label>` elements (important for accessibility —
 *   screen readers can read the label to blind users)
 *
 * USAGE:
 *   <FormField label="Email" error={errors.email}>
 *     <Input name="email" type="email" />
 *   </FormField>
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  /** The label text shown above the input */
  label?: string;
  /** Error message to display (undefined = no error) */
  error?: string;
  /** The input element(s) to render inside */
  children: React.ReactNode;
  /** Optional className for the wrapper */
  className?: string;
  /** Whether this field is required (adds a red * after the label) */
  required?: boolean;
}

export function FormField({
  label,
  error,
  children,
  className,
  required,
}: FormFieldProps) {
  // Generate a unique ID so the <label> can be linked to the <input>
  // (This is important for accessibility — clicking the label focuses the input)
  const id = React.useId();

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[var(--foreground)]"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-[var(--danger)]" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {/* Clone the child input to inject the `id` and error styling */}
      {React.Children.map(children, (child) => {
        if (React.isValidElement<{ id?: string; className?: string }>(child)) {
          return React.cloneElement(child, {
            id,
            className: cn(
              child.props.className,
              error &&
                "border-[var(--danger)] focus:ring-[var(--danger)] focus:border-[var(--danger)]",
            ),
          });
        }
        return child;
      })}
      {/* Error message */}
      {error && (
        <p className="text-xs font-medium text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

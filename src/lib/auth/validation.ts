/**
 * Auth Validation Schemas
 *
 * HOW THIS WORKS (for learning):
 *
 * "Validation" = checking if user input meets certain rules BEFORE sending it.
 *
 * We use a library called "Zod" (already installed in this project) to define
 * "schemas" — objects that describe what valid data looks like:
 *   - z.string() means "must be a string"
 *   - .email() means "must look like an email address"
 *   - .min(8) means "must be at least 8 characters"
 *
 * WHY validate on the client?
 * - Instant feedback (no waiting for server response)
 * - Better UX (user sees errors AS they type)
 * - Security (but we ALSO validate on the server — never trust the client alone!)
 *
 * WHAT IS z.object()?
 * It defines the shape of a form's data. Each key is a field name,
 * each value is a rule for what that field should contain.
 */

import { z } from "zod";

// ─── Login Schema ────────────────────────────────────────────────────────────
// Rules for the login form: valid email + password at least 4 chars (lenient
// for local dev seeds — Supabase enforces its own min-length).

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required"),
});

/** TypeScript type derived from the schema — keeps form data type-safe */
export type LoginFormData = z.infer<typeof loginSchema>;

// ─── Signup Schema ───────────────────────────────────────────────────────────
// Rules for the signup form: name, email, org name, and plan selection.

export const signupSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  orgName: z
    .string()
    .min(2, "Brokerage name must be at least 2 characters")
    .max(200, "Brokerage name is too long"),
  plan: z.enum(["solo", "team", "enterprise"], {
    error: "Please select a plan",
  }),
});

export type SignupFormData = z.infer<typeof signupSchema>;

// ─── Password Strength ──────────────────────────────────────────────────────
// Checks how strong a password is by looking for various criteria.
// Returns a score (0-4) and a label.
//
// HOW SCORING WORKS:
//   +1 for length >= 8
//   +1 for having uppercase + lowercase
//   +1 for having numbers
//   +1 for having special characters

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  color: string;
  /** Width percentage for the strength bar */
  percentage: number;
};

export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return { score: 0, label: "Too short", color: "var(--muted)", percentage: 0 };
  }

  let score = 0;

  // Length check
  if (password.length >= 8) score++;

  // Mixed case check
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;

  // Number check
  if (/\d/.test(password)) score++;

  // Special character check
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const levels: Record<number, Omit<PasswordStrength, "score">> = {
    0: { label: "Too short", color: "var(--danger)", percentage: 10 },
    1: { label: "Weak", color: "var(--danger)", percentage: 25 },
    2: { label: "Fair", color: "var(--warning)", percentage: 50 },
    3: { label: "Good", color: "var(--success)", percentage: 75 },
    4: { label: "Strong", color: "var(--success)", percentage: 100 },
  };

  return {
    score: score as PasswordStrength["score"],
    ...levels[score],
  };
}

// ─── Validation Helper ───────────────────────────────────────────────────────
// Validates form data against a Zod schema and returns field-level errors.
//
// HOW IT WORKS:
// 1. Try to parse the data with the schema
// 2. If it fails, Zod gives us a list of errors with "paths" (which field failed)
// 3. We convert those into a simple { fieldName: "error message" } object

export function validateForm<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Convert Zod errors into a simple object: { email: "Invalid email", name: "Too short" }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const fieldName = issue.path[0];
    if (fieldName && typeof fieldName === "string" && !errors[fieldName]) {
      errors[fieldName] = issue.message;
    }
  }

  return { success: false, errors };
}

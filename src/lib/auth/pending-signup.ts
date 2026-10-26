import { signupSchema, type SignupFormData } from "@/lib/auth/validation";
import type { PlanId } from "@/types";

/** Browser-only. The password stays here until checkout confirms the workspace. */
const STORAGE_KEY = "onestreet_pending_signup_v1";

export type PendingSignup = SignupFormData;

export function isPlanId(value: string | null | undefined): value is PlanId {
  return value === "solo" || value === "team" || value === "enterprise";
}

export function parsePendingSignup(raw: unknown): PendingSignup | null {
  const result = signupSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function savePendingSignup(signup: PendingSignup) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(signup));
}

export function loadPendingSignup(): PendingSignup | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return parsePendingSignup(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearPendingSignup() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Keeps the plan on the checkout step in sync with the details captured on the form. */
export function updatePendingPlan(plan: PlanId): PendingSignup | null {
  const current = loadPendingSignup();
  if (!current) return null;
  const next = { ...current, plan };
  savePendingSignup(next);
  return next;
}

let completion: Promise<"created" | "missing"> | null = null;

/**
 * Creates the workspace from the stored signup exactly once.
 * React strict mode remounts the return page; a second call joins the first.
 */
export function completePendingSignup(
  signUp: (input: PendingSignup) => Promise<void>,
): Promise<"created" | "missing"> {
  if (completion) return completion;
  const pending = loadPendingSignup();
  if (!pending) return Promise.resolve("missing");
  completion = (async () => {
    try {
      await signUp(pending);
    } catch (error) {
      completion = null;
      throw error;
    }
    clearPendingSignup();
    return "created" as const;
  })();
  return completion;
}

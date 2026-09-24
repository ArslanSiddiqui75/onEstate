import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hasModuleAccess } from "@/lib/access";
import { planIncludesModule } from "@/lib/plans/catalog";
import type { ModuleId, PlanId, Role } from "@/types";

export function LockedModule({
  title,
  reason,
  href = "/app/billing",
  role,
  plan,
  module,
  className,
}: {
  title: string;
  reason: string;
  href?: string;
  role?: Role;
  plan?: PlanId;
  /** When set, a plan that includes this module is a role lock, not an upgrade. */
  module?: ModuleId;
  className?: string;
}) {
  const roleGate =
    role && plan && module
      ? planIncludesModule(plan, module) &&
        !hasModuleAccess(role, plan, module, "view")
      : false;
  const canViewPlans =
    !roleGate && role && plan
      ? hasModuleAccess(role, plan, "billing", "view")
      : false;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[1.75rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(12,110,99,0.06),transparent)] px-6 py-24 text-center",
        className,
      )}
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
        <Lock className="h-5 w-5" aria-hidden />
      </div>
      <h2 className="font-display text-3xl tracking-tight text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{reason}</p>
      {roleGate ? (
        <p className="mt-7 max-w-sm text-sm text-[var(--muted)]">
          Ask an Owner to grant this. Your plan already includes it — this is a role limit.
        </p>
      ) : canViewPlans ? (
        <Button asChild className="mt-7 rounded-full">
          <Link href={href}>View plans</Link>
        </Button>
      ) : (
        <p className="mt-7 text-sm text-[var(--muted)]">
          Ask your Owner to upgrade if you need this module.
        </p>
      )}
    </div>
  );
}

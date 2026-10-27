"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** The section shown inside a module. The fallback is the module home and omits the query. */
export function useModuleSection<T extends string>(
  param: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const raw = params.get(param);
  const value = raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;

  const setValue = useCallback(
    (next: T) => {
      const nextParams = new URLSearchParams(params.toString());
      if (next === fallback) nextParams.delete(param);
      else nextParams.set(param, next);
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [fallback, param, params, pathname, router],
  );

  return [value, setValue];
}

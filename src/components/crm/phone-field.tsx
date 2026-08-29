"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  DIAL_CODES,
  defaultDialCode,
  isE164,
  splitE164,
  toE164,
} from "@/lib/phone/e164";
import type { Market } from "@/types";

export function PhoneField({
  name = "phone",
  market,
  defaultValue,
  required,
  className,
}: {
  name?: string;
  market: Market;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  const split = splitE164(defaultValue || "");
  const fallbackDial = defaultDialCode(market);
  const unmatchedPlus = Boolean(
    defaultValue?.trim().startsWith("+") && !split.dialCode,
  );
  const [dialCode, setDialCode] = useState(split.dialCode || fallbackDial);
  const [national, setNational] = useState(
    unmatchedPlus ? defaultValue!.trim() : split.national,
  );

  const e164 = useMemo(() => toE164(national, dialCode), [national, dialCode]);

  return (
    <div className={className}>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          className="h-10 w-[8.5rem] shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
          value={dialCode}
          onChange={(e) => setDialCode(e.target.value)}
        >
          {DIAL_CODES.map((row) => (
            <option key={row.code} value={row.code}>
              {row.label}
            </option>
          ))}
        </select>
        <Input
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="Local number"
          value={national}
          required={required}
          onChange={(e) => setNational(e.target.value)}
        />
      </div>
      <input type="hidden" name={name} value={e164} />
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        {e164
          ? `Saves as ${e164}`
          : "Pick a country, then type the local number. Leading 0 is dropped (0333… + Pakistan → +92333…)."}
        {defaultValue && !isE164(defaultValue)
          ? " This number was stored without a country code — confirm the country before saving."
          : null}
      </p>
    </div>
  );
}

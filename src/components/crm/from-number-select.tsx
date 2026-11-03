"use client";

import { MenuSelect } from "@/components/ui/select";

export interface FromNumberOption {
  id: string;
  phoneNumber: string;
  label?: string;
  isDefault: boolean;
}

export function FromNumberSelect({
  numbers,
  value,
  onChange,
  id = "from-number",
  className,
}: {
  numbers: FromNumberOption[];
  value: string;
  onChange: (next: string) => void;
  id?: string;
  className?: string;
}) {
  if (numbers.length <= 1) return null;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--muted)]">
        Send from
      </label>
      <MenuSelect
        id={id}
        aria-label="Send from phone number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {numbers.map((row) => (
          <option key={row.id || row.phoneNumber} value={row.phoneNumber}>
            {row.phoneNumber}
            {row.isDefault ? " (default)" : ""}
            {row.label ? ` · ${row.label}` : ""}
          </option>
        ))}
      </MenuSelect>
    </div>
  );
}

export function resolveOwnedNumbers(
  org:
    | {
        phoneNumber?: string;
        phoneNumbers?: FromNumberOption[];
      }
    | null
    | undefined,
): FromNumberOption[] {
  if (org?.phoneNumbers && org.phoneNumbers.length > 0) return org.phoneNumbers;
  if (org?.phoneNumber) {
    return [{ id: "legacy", phoneNumber: org.phoneNumber, isDefault: true }];
  }
  return [];
}

export function defaultFromNumber(numbers: FromNumberOption[]): string {
  return numbers.find((row) => row.isDefault)?.phoneNumber || numbers[0]?.phoneNumber || "";
}

"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 text-left text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-[var(--accent)] data-[state=open]:ring-2 data-[state=open]:ring-[var(--ring)] data-[placeholder]:text-[var(--muted)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)]" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1 text-[var(--muted)]",
      className,
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

export const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1 text-[var(--muted)]",
      className,
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={cn(
        "relative z-[240] max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[8rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[var(--shadow-float)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
        position === "popper" &&
          "w-max min-w-[var(--radix-select-trigger-width)] max-w-[min(22rem,var(--radix-select-content-available-width))]",
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "max-h-[min(20rem,var(--radix-select-content-available-height))] w-full overflow-y-auto p-1.5",
          position === "popper" &&
            "min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center gap-3 rounded-xl py-2.5 pr-3 pl-3 text-sm outline-none transition data-[highlighted]:bg-[var(--accent-soft)] data-[state=checked]:bg-[var(--accent-soft)] data-[state=checked]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="min-w-0 flex-1 truncate">
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </span>
    <SelectPrimitive.ItemIndicator>
      <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const EMPTY = "\u0000";

type MenuOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type MenuChange = {
  target: { value: string };
  currentTarget: { value: string; form: HTMLFormElement | null };
};

function menuOptions(children: React.ReactNode): MenuOption[] {
  const options: MenuOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: string; disabled?: boolean; children?: React.ReactNode }>(child)) return;
    if (child.type !== "option") return;
    options.push({
      value: child.props.value == null ? "" : String(child.props.value),
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    });
  });
  return options;
}

/** Styled menu that replaces a native select, including inside forms. */
export function MenuSelect({
  name,
  value,
  defaultValue,
  onChange,
  children,
  className,
  disabled,
  required,
  id,
  style,
  menuStyle,
  "aria-label": ariaLabel,
  ...rest
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "size"> & {
  onChange?: (event: MenuChange) => void;
  menuStyle?: React.CSSProperties;
}) {
  const passed = rest as Record<string, unknown>;
  const extra: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(passed)) {
    if (key.startsWith("data-") || key.startsWith("aria-")) extra[key] = entry;
  }
  const options = menuOptions(children);
  const placeholder = options.find((option) => option.value === "" && option.disabled)?.label;
  const items = options.filter((option) => option.value !== "" || !option.disabled);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uncontrolled, setUncontrolled] = React.useState(() =>
    defaultValue == null ? "" : String(defaultValue),
  );
  const current = value !== undefined && value !== null ? String(value) : uncontrolled;

  function choose(next: string) {
    const form = inputRef.current?.form ?? null;
    const event: MenuChange = {
      target: { value: next },
      currentTarget: { value: next, form },
    };
    onChange?.(event);
    if (value !== undefined) return;
    const cleared = event.target.value === "" || event.currentTarget.value === "";
    setUncontrolled(cleared ? "" : next);
  }

  return (
    <>
      <Select
        value={current === "" ? EMPTY : current}
        onValueChange={(next) => choose(next === EMPTY ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-label={ariaLabel} className={className} style={style} {...extra}>
          <SelectValue placeholder={placeholder || "Choose"} />
        </SelectTrigger>
        <SelectContent style={menuStyle}>
          {items.map((option) => (
            <SelectItem
              key={option.value === "" ? EMPTY : option.value}
              value={option.value === "" ? EMPTY : option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {name ? (
        <input ref={inputRef} type="hidden" name={name} value={current} required={required} />
      ) : null}
    </>
  );
}

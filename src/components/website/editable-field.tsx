"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ImagePlus } from "lucide-react";

export function EditableText({
  value,
  onChange,
  enabled,
  multiline,
  className,
  style,
  placeholder,
  as: Tag = "span",
}: {
  value: string;
  onChange: (next: string) => void;
  enabled?: boolean;
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  as?: "span" | "h1" | "h2" | "h3" | "h4" | "p";
}) {
  const [editing, setEditing] = useState(false);

  if (!enabled) {
    return (
      <Tag className={className} style={style}>
        {value || placeholder}
      </Tag>
    );
  }

  if (editing) {
    const shared = {
      className: `${className || ""} w-full bg-transparent outline-none ring-2 ring-white/80 ring-offset-2 ring-offset-black/20`,
      style,
      autoFocus: true,
      value,
      placeholder,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => onChange(e.target.value),
      onBlur: () => setEditing(false),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          setEditing(false);
        }
        if (e.key === "Escape") setEditing(false);
      },
    };
    if (multiline) {
      return <textarea {...shared} rows={4} />;
    }
    return <input {...shared} />;
  }

  return (
    <Tag
      className={`${className || ""} cursor-text rounded-sm outline-dashed outline-2 outline-transparent transition hover:outline-[var(--accent)] hover:outline-offset-4`}
      style={style}
      title="Click to edit"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {value || <span className="opacity-50">{placeholder || "Add text"}</span>}
    </Tag>
  );
}

export function EditableImage({
  enabled,
  uploading,
  onPickFile,
  label,
  children,
  className,
  style,
}: {
  enabled?: boolean;
  uploading?: boolean;
  onPickFile: (file: File) => void;
  label?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!enabled) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`${className || ""} group/img relative outline-dashed outline-2 outline-transparent transition hover:outline-[var(--accent)] hover:outline-offset-[-4px]`}
      style={style}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickFile(file);
          e.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 opacity-0 shadow transition group-hover/img:opacity-100"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        <ImagePlus className="h-3.5 w-3.5" />
        {uploading ? "Uploading…" : label || "Change image"}
      </button>
    </div>
  );
}

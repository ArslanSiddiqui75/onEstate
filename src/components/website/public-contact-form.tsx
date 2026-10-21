"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

export interface PublicContactFormProps {
  /** Slug or custom domain used to resolve the owning org server-side */
  site: string;
  ctaLabel: string;
  colors: {
    surface: string;
    text: string;
    muted: string;
    accent: string;
    accentText: string;
    border: string;
  };
  wrapperBackground: string;
  layout?: "compact" | "stacked";
}

export function PublicContactForm({
  site,
  ctaLabel,
  colors,
  wrapperBackground,
  layout = "compact",
}: PublicContactFormProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const fieldStyle: CSSProperties = {
    backgroundColor: colors.surface,
    color: colors.text,
    border: `1px solid ${colors.border}`,
  };

  async function submit() {
    if (!name.trim() || !contact.trim()) {
      setStatus("error");
      setErrorMessage("Add your name and a way to reach you.");
      return;
    }
    setStatus("sending");
    setErrorMessage("");

    const looksLikeEmail = contact.includes("@");
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site,
          name: name.trim(),
          email: looksLikeEmail ? contact.trim() : "",
          phone: looksLikeEmail ? "" : contact.trim(),
          message: message.trim(),
          honeypot,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setErrorMessage(json.error || "Something went wrong. Please try again.");
        return;
      }
      setStatus("sent");
      setName("");
      setContact("");
      setMessage("");
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div
        className="rounded-[1.75rem] p-8 text-center"
        style={{ backgroundColor: wrapperBackground }}
      >
        <p className="text-lg font-medium" style={{ color: colors.text }}>
          Thanks — we’ve got your details.
        </p>
        <p className="mt-2 text-sm" style={{ color: colors.muted }}>
          Someone from the team will be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      className="rounded-[1.75rem] p-3"
      style={{ backgroundColor: wrapperBackground }}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div
        className={
          layout === "stacked"
            ? "grid gap-3"
            : "grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        }
      >
        <input
          className="rounded-2xl px-4 py-3 text-sm outline-none"
          style={fieldStyle}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded-2xl px-4 py-3 text-sm outline-none"
          style={fieldStyle}
          placeholder="Email / phone"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          required
        />
        {layout === "stacked" ? null : (
          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium disabled:opacity-60"
            style={{
              backgroundColor: colors.accent,
              color: colors.accentText,
              borderRadius: 9999,
            }}
          >
            {status === "sending" ? "Sending…" : ctaLabel}
          </button>
        )}
      </div>

      <textarea
        className="mt-3 min-h-24 w-full rounded-2xl px-4 py-3 text-sm outline-none"
        style={fieldStyle}
        placeholder="What are you looking for? (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      {layout === "stacked" ? (
        <button
          type="submit"
          disabled={status === "sending"}
          className="mt-3 inline-flex w-full items-center justify-center px-6 py-3 text-sm font-medium disabled:opacity-60 sm:w-auto"
          style={{
            backgroundColor: colors.accent,
            color: colors.accentText,
            borderRadius: 9999,
          }}
        >
          {status === "sending" ? "Sending…" : ctaLabel}
        </button>
      ) : null}

      {/* Spam trap — hidden from real visitors */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
      />

      {status === "error" ? (
        <p className="mt-2 px-1 text-sm" style={{ color: "#dc2626" }}>
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}

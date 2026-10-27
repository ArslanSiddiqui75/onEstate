"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

export interface EnquiryInput {
  name: string;
  email: string;
  phone: string;
  message: string;
  type: "buyer" | "seller" | "landlord" | "tenant";
}

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
  /**
   * When set, the form saves through the signed-in workspace instead of the
   * public endpoint. Used by the website editor so a test enquiry still lands
   * in Opportunities and Contacts.
   */
  onCapture?: (input: EnquiryInput) => Promise<void>;
}

export function PublicContactForm({
  site,
  ctaLabel,
  colors,
  wrapperBackground,
  layout = "stacked",
  onCapture,
}: PublicContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<EnquiryInput["type"]>("buyer");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const fieldStyle: CSSProperties = {
    backgroundColor: colors.surface,
    color: colors.text,
    border: `1px solid ${colors.border}`,
  };

  async function submit() {
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      setStatus("error");
      setErrorMessage("Add your name, and an email or a phone number.");
      return;
    }
    setStatus("sending");
    setErrorMessage("");

    const input: EnquiryInput = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim(),
      type,
    };
    try {
      if (onCapture) {
        await onCapture(input);
      } else {
        const res = await fetch("/api/public/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site, ...input, honeypot }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setStatus("error");
          setErrorMessage(json.error || "Something went wrong. Please try again.");
          return;
        }
      }
      setStatus("sent");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Network error. Please try again.");
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
          You’re in the pipeline. Someone from the team will be in touch shortly.
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
      <div className={layout === "stacked" ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
        <input
          className="rounded-2xl px-4 py-3 text-sm outline-none sm:col-span-2"
          style={fieldStyle}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded-2xl px-4 py-3 text-sm outline-none"
          style={fieldStyle}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded-2xl px-4 py-3 text-sm outline-none"
          style={fieldStyle}
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <select
          className="rounded-2xl px-4 py-3 text-sm outline-none sm:col-span-2"
          style={fieldStyle}
          value={type}
          onChange={(e) => setType(e.target.value as EnquiryInput["type"])}
        >
          <option value="buyer">I want to buy</option>
          <option value="seller">I want to sell</option>
          <option value="landlord">I want to let a property</option>
          <option value="tenant">I want to rent</option>
        </select>
      </div>

      <textarea
        className="mt-3 min-h-24 w-full rounded-2xl px-4 py-3 text-sm outline-none"
        style={fieldStyle}
        placeholder="Tell us what you need"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

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

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getActiveBrand } from "@/lib/brand/config";

export function WaitlistForm() {
  const brand = getActiveBrand();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          market: brand.waitlistMarketFixed,
          brand: brand.id,
          brokerage: form.get("brokerage"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus("done");
      setMessage(data.message);
      e.currentTarget.reset();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to submit");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-3 sm:grid-cols-2">
      <Input name="name" placeholder="Your name" required aria-label="Name" />
      <Input
        name="email"
        type="email"
        placeholder="Work email"
        required
        aria-label="Email"
      />
      <Input
        name="brokerage"
        placeholder="Brokerage / team"
        aria-label="Brokerage"
        className="sm:col-span-2"
      />
      <p className="sm:col-span-2 text-xs text-[var(--muted)]">
        Requesting a {brand.name} demo for {brand.localeLabel}.
      </p>
      <div className="sm:col-span-2">
        <Button
          type="submit"
          size="lg"
          className="rounded-full"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Submitting..." : brand.contactCta}
        </Button>
        {message ? (
          <p
            className={`mt-3 text-sm ${status === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

import { describe, expect, it } from "vitest";
import {
  assertCanSendMessage,
  ensureEmailComplianceFooter,
  ensureSmsComplianceFooter,
  isWithinQuietHours,
  shouldSuspendChannel,
  twimlMessage,
} from "@/lib/messaging/compliance";
import {
  isEmailUnsubscribeMessage,
  isHelpMessage,
  isOptInMessage,
  isOptOutMessage,
} from "@/lib/messaging/opt-out";

describe("TCPA / PECR keywords", () => {
  it("recognises STOP, START, and HELP", () => {
    expect(isOptOutMessage("STOP")).toBe(true);
    expect(isOptInMessage("START")).toBe(true);
    expect(isHelpMessage("HELP")).toBe(true);
    expect(isEmailUnsubscribeMessage("Please unsubscribe me", "thanks")).toBe(true);
  });
});

describe("assertCanSendMessage", () => {
  it("blocks opted-out contacts on every path", () => {
    const gate = assertCanSendMessage({
      channel: "sms",
      kind: "manual",
      consent: "opted_out",
      market: "us",
    });
    expect(gate.ok).toBe(false);
  });

  it("requires opt-in for bulk and automation", () => {
    const bulk = assertCanSendMessage({
      channel: "sms",
      kind: "bulk",
      consent: "unknown",
      market: "uk",
    });
    expect(bulk.ok).toBe(false);
    if (!bulk.ok) expect(bulk.code).toBe("consent_required");

    const auto = assertCanSendMessage({
      channel: "email",
      kind: "automation",
      consent: "unknown",
      market: "uk",
    });
    expect(auto.ok).toBe(false);
  });

  it("allows manual 1:1 with unknown consent", () => {
    const gate = assertCanSendMessage({
      channel: "sms",
      kind: "manual",
      consent: "unknown",
      market: "us",
    });
    expect(gate.ok).toBe(true);
  });

  it("honours workspace channel suspension", () => {
    const gate = assertCanSendMessage({
      channel: "sms",
      kind: "manual",
      consent: "opted_in",
      market: "us",
      compliance: {
        sms: { suspendedAt: new Date().toISOString(), reason: "Too many opt-outs", by: "system" },
      },
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.code).toBe("channel_suspended");
  });

  it("blocks marketing SMS during quiet hours", () => {
    // 03:00 America/New_York
    const night = new Date("2026-06-15T07:00:00.000Z");
    const gate = assertCanSendMessage({
      channel: "sms",
      kind: "bulk",
      consent: "opted_in",
      market: "us",
      phoneE164: "+12125551212",
      now: night,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.code).toBe("quiet_hours");
    expect(isWithinQuietHours({ market: "us", phoneE164: "+12125551212", now: night })).toBe(
      true,
    );
  });
});

describe("compliance footers and suspension math", () => {
  it("appends STOP / unsubscribe copy when missing", () => {
    expect(ensureSmsComplianceFooter("Hi there", "bulk")).toMatch(/STOP/i);
    expect(ensureEmailComplianceFooter("Hello", "sequence")).toMatch(/UNSUBSCRIBE/i);
    expect(ensureSmsComplianceFooter("Reply STOP please", "bulk")).toBe("Reply STOP please");
    expect(
      ensureEmailComplianceFooter("Hello", "bulk", {
        footer: "Leave anytime via unsubscribe.",
      }),
    ).toContain("Leave anytime via unsubscribe.");
    expect(
      ensureEmailComplianceFooter("Hello", "bulk", { enabled: false }),
    ).toBe("Hello");
  });

  it("escapes TwiML message bodies", () => {
    expect(twimlMessage(`A & B <C>`)).toContain("&amp;");
    expect(twimlMessage(`A & B <C>`)).toContain("&lt;C&gt;");
  });

  it("suspends on high opt-out rate or 24h spike", () => {
    expect(
      shouldSuspendChannel({ sends: 25, optOuts: 3, spikeOptOuts: 1 }).suspend,
    ).toBe(true);
    expect(
      shouldSuspendChannel({ sends: 5, optOuts: 1, spikeOptOuts: 10 }).suspend,
    ).toBe(true);
    expect(
      shouldSuspendChannel({ sends: 25, optOuts: 1, spikeOptOuts: 1 }).suspend,
    ).toBe(false);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { getEmailCapabilities, shouldUseResendOutbound } from "@/lib/email/capabilities";

const KEYS = [
  "EMAIL_MODE",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
] as const;

const previous = new Map<string, string | undefined>();

function setEnv(patch: Partial<Record<(typeof KEYS)[number], string | undefined>>) {
  for (const key of KEYS) {
    if (!previous.has(key)) previous.set(key, process.env[key]);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previous.clear();
});

describe("getEmailCapabilities", () => {
  it("reports SMTP for CRM outbound when the host is set", () => {
    setEnv({
      EMAIL_MODE: "auto",
      SMTP_HOST: "smtp.example.test",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "0neStreet <onboarding@resend.dev>",
    });
    const caps = getEmailCapabilities();
    expect(caps.outbound).toBe("smtp");
    expect(caps.mode).toBe("live");
    expect(caps.smtpConfigured).toBe(true);
    expect(caps.resendConfigured).toBe(true);
    expect(shouldUseResendOutbound()).toBe(true);
  });

  it("stays simulated for CRM when SMTP is missing even if Resend is keyed", () => {
    setEnv({
      EMAIL_MODE: "auto",
      SMTP_HOST: undefined,
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "0neStreet <onboarding@resend.dev>",
    });
    const caps = getEmailCapabilities();
    expect(caps.outbound).toBe("simulated");
    expect(caps.mode).toBe("simulated");
    expect(shouldUseResendOutbound()).toBe(true);
  });
});

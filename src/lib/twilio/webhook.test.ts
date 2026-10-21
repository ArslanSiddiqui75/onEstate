import { afterEach, describe, expect, it, vi } from "vitest";
import { twilioWebhookUrl } from "@/lib/twilio/webhook";
import { readTwilioWebhookParams } from "@/lib/twilio/webhook";

describe("twilioWebhookUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers TWILIO_WEBHOOK_BASE_URL over NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("TWILIO_WEBHOOK_BASE_URL", "https://hooks.example.com/");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    const url = twilioWebhookUrl(
      new Request("https://internal/api/twilio/webhook/inbound?x=1"),
    );
    expect(url).toBe(
      "https://hooks.example.com/api/twilio/webhook/inbound?x=1",
    );
  });

  it("falls back to forwarded proto/host", () => {
    delete process.env.TWILIO_WEBHOOK_BASE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const url = twilioWebhookUrl(
      new Request("http://127.0.0.1/api/twilio/webhook/status", {
        headers: {
          "x-forwarded-proto": "https",
          "x-forwarded-host": "on-estate.vercel.app",
        },
      }),
    );
    expect(url).toBe("https://on-estate.vercel.app/api/twilio/webhook/status");
  });
});

describe("readTwilioWebhookParams", () => {
  it("parses form-urlencoded bodies", async () => {
    const params = await readTwilioWebhookParams(
      new Request("https://example.com/hook", {
        method: "POST",
        body: "From=%2B447700900123&Body=Hi+there&MessageSid=SM123",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
    );
    expect(params).toEqual({
      From: "+447700900123",
      Body: "Hi there",
      MessageSid: "SM123",
    });
  });
});

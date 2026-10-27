import { shouldUseTwilioOutbound } from "@/lib/messaging/capabilities";

export function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

export async function sendTwilioSms(input: {
  to: string;
  body: string;
  from?: string;
}): Promise<{ sid: string; status: string; mode: "live" | "simulated" }> {
  const from = (input.from || process.env.TWILIO_FROM_NUMBER || "").trim();
  const accountReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && from,
  );
  if (!accountReady || (!input.from && !shouldUseTwilioOutbound())) {
    return {
      sid: `sim_${Date.now()}`,
      status: "sent",
      mode: "simulated",
    };
  }

  const twilio = await import("twilio");
  const client = twilio.default(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!,
  );
  const message = await client.messages.create({
    to: input.to,
    from,
    body: input.body,
  });
  return {
    sid: message.sid,
    status: message.status || "sent",
    mode: "live",
  };
}

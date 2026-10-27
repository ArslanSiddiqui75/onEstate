import twilio from "twilio";
import { isE164 } from "@/lib/phone/e164";

export type NumberCountry = "GB" | "US";

export interface AvailableNumber {
  phoneNumber: string;
  locality: string;
  region: string;
}

export function hasTwilioAccount() {
  return Boolean(
    (process.env.TWILIO_ACCOUNT_SID || "").trim() &&
      (process.env.TWILIO_AUTH_TOKEN || "").trim(),
  );
}

function client() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

export function countryForMarket(market: string | null | undefined): NumberCountry {
  return market === "us" ? "US" : "GB";
}

export async function searchNumbers(country: NumberCountry, contains?: string) {
  if (!hasTwilioAccount()) {
    return { configured: false as const, numbers: [] as AvailableNumber[] };
  }
  const digits = (contains || "").replace(/\D/g, "").slice(0, 10);
  const options = {
    smsEnabled: true,
    voiceEnabled: true,
    limit: 8,
    ...(digits ? { contains: digits } : {}),
  };
  const rows =
    country === "GB"
      ? await client().availablePhoneNumbers("GB").mobile.list(options)
      : await client().availablePhoneNumbers("US").local.list(options);
  return {
    configured: true as const,
    numbers: rows.map((row) => ({
      phoneNumber: row.phoneNumber,
      locality: row.locality || "",
      region: row.region || "",
    })),
  };
}

export async function buyNumber(phoneNumber: string) {
  if (!hasTwilioAccount()) {
    throw new Error("Twilio is not connected on this server yet.");
  }
  if (!isE164(phoneNumber)) throw new Error("Choose a number from the list.");
  const base = (
    process.env.TWILIO_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).replace(/\/$/, "");
  const purchased = await client().incomingPhoneNumbers.create({
    phoneNumber,
    ...(base
      ? {
          smsUrl: `${base}/api/twilio/webhook/inbound`,
          smsMethod: "POST" as const,
          statusCallback: `${base}/api/twilio/webhook/status`,
          statusCallbackMethod: "POST" as const,
        }
      : {}),
  });
  return purchased.phoneNumber;
}

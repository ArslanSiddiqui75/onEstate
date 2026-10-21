import { isTwilioConfigured } from "@/lib/twilio/client";

export type MessagingMode = "auto" | "simulated" | "twilio";

export type MessagingChannel = "twilio" | "simulated";

export interface MessagingCapabilities {
  /** Resolved runtime mode shown in the UI */
  mode: "live" | "simulated";
  outbound: MessagingChannel;
  /** Real SMS arrives via Twilio webhook; otherwise use in-app simulate */
  inbound: "twilio_webhook" | "in_app";
  twilioConfigured: boolean;
  /** In-app test replies always available to signed-in CRM users */
  canSimulateInbound: boolean;
}

function readMessagingMode(): MessagingMode {
  const raw = (process.env.MESSAGING_MODE || "auto").toLowerCase();
  if (raw === "simulated" || raw === "twilio") return raw;
  return "auto";
}

export function getMessagingCapabilities(): MessagingCapabilities {
  const configured = isTwilioConfigured();
  const setting = readMessagingMode();

  const useTwilio =
    setting === "twilio" || (setting === "auto" && configured);

  return {
    mode: useTwilio ? "live" : "simulated",
    outbound: useTwilio ? "twilio" : "simulated",
    inbound: useTwilio ? "twilio_webhook" : "in_app",
    twilioConfigured: configured,
    canSimulateInbound: true,
  };
}

export function shouldUseTwilioOutbound(): boolean {
  return getMessagingCapabilities().outbound === "twilio";
}

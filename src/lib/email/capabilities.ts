export type EmailMode = "auto" | "simulated" | "resend";

export interface EmailCapabilities {
  mode: "live" | "simulated";
  outbound: "resend" | "simulated";
  resendConfigured: boolean;
  from: string;
}

function readEmailMode(): EmailMode {
  const raw = (process.env.EMAIL_MODE || "auto").toLowerCase();
  if (raw === "simulated" || raw === "resend") return raw;
  return "auto";
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function emailFromAddress(): string {
  return (process.env.EMAIL_FROM || "").trim();
}

export function getEmailCapabilities(): EmailCapabilities {
  const configured = isResendConfigured();
  const setting = readEmailMode();
  const useResend = setting === "resend" || (setting === "auto" && configured);

  return {
    mode: useResend ? "live" : "simulated",
    outbound: useResend ? "resend" : "simulated",
    resendConfigured: configured,
    from: emailFromAddress(),
  };
}

export function shouldUseResendOutbound(): boolean {
  return getEmailCapabilities().outbound === "resend";
}

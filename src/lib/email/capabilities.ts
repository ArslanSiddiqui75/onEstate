export type EmailMode = "auto" | "simulated" | "resend";

export interface EmailCapabilities {
  mode: "live" | "simulated";
  outbound: "resend" | "simulated";
  resendConfigured: boolean;
  from: string;
  /** Present when the operator set a key but forgot the sender (or vice versa). */
  configError?: string;
}

function readEmailMode(): EmailMode {
  const raw = (process.env.EMAIL_MODE || "auto").toLowerCase().trim();
  // Docs show `auto|simulated|resend` — people paste that as the value.
  if (raw.includes("|")) return "auto";
  if (raw === "simulated" || raw === "resend") return raw;
  return "auto";
}

export function emailFromAddress(): string {
  return (process.env.EMAIL_FROM || "").trim();
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && emailFromAddress());
}

export function emailConfigError(): string | undefined {
  const setting = readEmailMode();
  if (setting === "simulated") return undefined;
  const hasKey = Boolean(process.env.RESEND_API_KEY);
  const hasFrom = Boolean(emailFromAddress());
  if (hasKey && !hasFrom) {
    return "EMAIL_FROM is missing. Use a verified Resend sender, e.g. 0nEstate <beth.t@example.com>.";
  }
  if (setting === "resend" && !hasKey) {
    return "RESEND_API_KEY is not set.";
  }
  if (setting === "resend" && !hasFrom) {
    return "EMAIL_FROM is not set.";
  }
  return undefined;
}

export function getEmailCapabilities(): EmailCapabilities {
  const configured = isResendConfigured();
  const setting = readEmailMode();
  const configError = emailConfigError();
  const useResend =
    !configError && (setting === "resend" || (setting === "auto" && configured));

  return {
    mode: useResend ? "live" : "simulated",
    outbound: useResend ? "resend" : "simulated",
    resendConfigured: configured,
    from: emailFromAddress(),
    configError,
  };
}

export function shouldUseResendOutbound(): boolean {
  return getEmailCapabilities().outbound === "resend";
}

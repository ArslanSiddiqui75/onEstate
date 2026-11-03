import { smtpConfigured } from "@/lib/email/domain";

export type EmailMode = "auto" | "simulated" | "resend" | "smtp";

export interface EmailCapabilities {
  /** CRM conversation outbound readiness (SMTP). */
  mode: "live" | "simulated";
  /** How CRM conversation email is sent. */
  outbound: "smtp" | "simulated";
  /** Resend is for invites / e-sign only — not CRM conversations. */
  resendConfigured: boolean;
  /** True when SMTP is ready for CRM outbound. */
  smtpConfigured: boolean;
  inboundWebhook: boolean;
  inboundAddress: string;
  from: string;
  /** Present when transactional Resend is half-configured. */
  configError?: string;
}

function readEmailMode(): EmailMode {
  const raw = (process.env.EMAIL_MODE || "auto").toLowerCase().trim();
  // Docs show `auto|simulated|resend` — people paste that as the value.
  if (raw.includes("|")) return "auto";
  if (raw === "simulated" || raw === "resend" || raw === "smtp") return raw;
  return "auto";
}

function fromLooksUnverified(from: string) {
  const host = from.toLowerCase();
  return (
    host.includes("@example.com") ||
    host.includes("@example.org") ||
    host.includes("@example.net")
  );
}

export function emailFromAddress(): string {
  return (process.env.EMAIL_FROM || "").trim();
}

export function isResendConfigured() {
  const from = emailFromAddress();
  return Boolean(process.env.RESEND_API_KEY && from && !fromLooksUnverified(from));
}

export function inboundWebhookConfigured() {
  return Boolean((process.env.RESEND_WEBHOOK_SECRET || "").trim());
}

export function emailConfigError(): string | undefined {
  const setting = readEmailMode();
  if (setting === "simulated") return undefined;
  const hasKey = Boolean(process.env.RESEND_API_KEY);
  const from = emailFromAddress();
  const hasFrom = Boolean(from);
  if (hasKey && !hasFrom) {
    return "EMAIL_FROM is missing. For invite/e-sign mail use 0neStreet <onboarding@resend.dev>, or a domain verified at resend.com/domains.";
  }
  if (hasFrom && fromLooksUnverified(from)) {
    return "EMAIL_FROM cannot use example.com. Use a Resend test sender or a verified domain.";
  }
  if (setting === "resend" && !hasKey) {
    return "RESEND_API_KEY is not set (needed for invites and e-sign).";
  }
  if (setting === "resend" && !hasFrom) {
    return "EMAIL_FROM is not set.";
  }
  if (setting === "smtp" && !smtpConfigured()) {
    return "SMTP_HOST is not set. Conversations send through SMTP.";
  }
  return undefined;
}

/**
 * CRM conversation outbound uses SMTP (`sendDomainEmail`).
 * Resend stays for invites / e-sign transactional mail only.
 */
export function getEmailCapabilities(): EmailCapabilities {
  const resendConfigured = isResendConfigured();
  const smtpReady = smtpConfigured();
  const setting = readEmailMode();
  const configError = emailConfigError();
  const useSmtp =
    !configError &&
    setting !== "simulated" &&
    setting !== "resend" &&
    (setting === "smtp" || setting === "auto") &&
    smtpReady;

  return {
    mode: useSmtp ? "live" : "simulated",
    outbound: useSmtp ? "smtp" : "simulated",
    resendConfigured,
    smtpConfigured: smtpReady,
    inboundWebhook: inboundWebhookConfigured(),
    inboundAddress: (process.env.EMAIL_INBOUND_ADDRESS || "").trim(),
    from: emailFromAddress(),
    configError,
  };
}

/** Invites and e-sign — not CRM conversation outbound. */
export function shouldUseResendOutbound(): boolean {
  const setting = readEmailMode();
  if (setting === "simulated") return false;
  if (emailConfigError()) return false;
  if (setting === "resend") return isResendConfigured();
  // auto: Resend for transactional when keyed; CRM still uses SMTP separately.
  return isResendConfigured();
}

export type EsignMode = "auto" | "simulated" | "live";

export interface EsignCapabilities {
  mode: "live" | "simulated";
  /** Live = Dropbox Sign (or similar) when a key is set later. Today always simulated. */
  provider: "simulated" | "dropbox_sign";
  canEmailInvite: boolean;
}

function readMode(): EsignMode {
  const raw = (process.env.ESIGN_MODE || "auto").toLowerCase().trim();
  if (raw.includes("|")) return "auto";
  if (raw === "simulated" || raw === "live") return raw;
  return "auto";
}

export function dropboxSignConfigured() {
  return Boolean((process.env.DROPBOX_SIGN_API_KEY || "").trim());
}

export function getEsignCapabilities(): EsignCapabilities {
  const setting = readMode();
  const live = dropboxSignConfigured() && setting !== "simulated";
  const useLive = setting === "live" ? dropboxSignConfigured() : live;
  return {
    mode: useLive ? "live" : "simulated",
    provider: useLive ? "dropbox_sign" : "simulated",
    canEmailInvite: Boolean(
      process.env.RESEND_API_KEY && (process.env.EMAIL_FROM || "").trim(),
    ),
  };
}

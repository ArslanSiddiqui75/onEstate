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

/**
 * E-sign stays simulated until Dropbox Sign (or another provider) is wired
 * end-to-end in `requestEsign`. A configured API key alone must not flip the
 * UI/API to "live" — that would be a false production claim.
 */
export function getEsignCapabilities(): EsignCapabilities {
  const setting = readMode();
  if (
    (setting === "live" || dropboxSignConfigured()) &&
    process.env.NODE_ENV !== "test"
  ) {
    console.warn(
      "[esign] DROPBOX_SIGN_API_KEY / ESIGN_MODE=live is set, but live Dropbox Sign is not wired yet — staying simulated.",
    );
  }
  return {
    mode: "simulated",
    provider: "simulated",
    canEmailInvite: Boolean(
      process.env.RESEND_API_KEY && (process.env.EMAIL_FROM || "").trim(),
    ),
  };
}

/** Public brokerage details the owner fills in on Settings. */

export interface BusinessProfile {
  tradingName: string;
  address: string;
  city: string;
  postcode: string;
  phone: string;
  email: string;
  website: string;
  about: string;
}

export const EMPTY_BUSINESS: BusinessProfile = {
  tradingName: "",
  address: "",
  city: "",
  postcode: "",
  phone: "",
  email: "",
  website: "",
  about: "",
};

function text(value: unknown, max: number) {
  return (typeof value === "string" ? value : "").trim().slice(0, max);
}

export function normalizeBusinessProfile(
  input: Partial<BusinessProfile> | null | undefined,
): BusinessProfile {
  return {
    tradingName: text(input?.tradingName, 120),
    address: text(input?.address, 160),
    city: text(input?.city, 80),
    postcode: text(input?.postcode, 16),
    phone: text(input?.phone, 20),
    email: text(input?.email, 160).toLowerCase(),
    website: text(input?.website, 200),
    about: text(input?.about, 600),
  };
}

export function businessProfileFilled(profile: BusinessProfile | undefined) {
  if (!profile) return false;
  return Object.values(profile).some((value) => value.trim().length > 0);
}

export function readBusinessProfile(raw: unknown): BusinessProfile | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const profile = normalizeBusinessProfile(raw as Partial<BusinessProfile>);
  return businessProfileFilled(profile) ? profile : undefined;
}

export function validateBusinessProfile(
  input: Partial<BusinessProfile>,
): { ok: true; value: BusinessProfile } | { ok: false; error: string } {
  const value = normalizeBusinessProfile(input);
  if (value.tradingName.length < 2) {
    return { ok: false, error: "Trading name must be at least 2 characters" };
  }
  if (value.phone && !/^\+[1-9]\d{7,14}$/.test(value.phone)) {
    return { ok: false, error: "Add a business phone with the country code." };
  }
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
    return { ok: false, error: "Business email looks incomplete." };
  }
  if (value.website) {
    const bare = value.website.replace(/^https?:\/\//i, "");
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}([/?#].*)?$/i.test(bare)) {
      return { ok: false, error: "Website should look like northbridge.co.uk" };
    }
    value.website = /^https?:\/\//i.test(value.website)
      ? value.website
      : `https://${bare}`;
  }
  return { ok: true, value };
}

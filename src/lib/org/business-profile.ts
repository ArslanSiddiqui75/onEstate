/** Public brokerage details the owner fills in on Settings → Business Profile. */

export const BUSINESS_NICHES = [
  { value: "", label: "Choose one…" },
  { value: "real_estate", label: "Real estate" },
  { value: "property_management", label: "Property management" },
  { value: "lettings", label: "Lettings / rentals" },
  { value: "mortgage", label: "Mortgage / finance" },
  { value: "other", label: "Other" },
] as const;

export const BUSINESS_CURRENCIES = [
  { value: "", label: "Choose one…" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
] as const;

export const BUSINESS_TYPES = [
  { value: "", label: "Choose one…" },
  { value: "sole_proprietorship", label: "Sole proprietorship" },
  { value: "llc", label: "Limited liability company (LLC)" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "ltd", label: "Private limited company (Ltd)" },
  { value: "plc", label: "Public limited company (PLC)" },
  { value: "other", label: "Other" },
] as const;

export const BUSINESS_INDUSTRIES = [
  { value: "", label: "Choose one…" },
  { value: "real_estate", label: "Real estate" },
  { value: "property_management", label: "Property management" },
  { value: "construction", label: "Construction" },
  { value: "professional_services", label: "Professional services" },
  { value: "other", label: "Other" },
] as const;

export const REGISTRATION_ID_TYPES = [
  { value: "", label: "Choose one…" },
  { value: "us_ein", label: "USA: Employer Identification Number (EIN)" },
  { value: "uk_company_number", label: "UK: Companies House number" },
  { value: "uk_vat", label: "UK: VAT registration number" },
  { value: "other", label: "Other registration ID" },
] as const;

export const OPERATION_REGIONS = [
  { value: "africa", label: "Africa" },
  { value: "asia", label: "Asia" },
  { value: "europe", label: "Europe" },
  { value: "latin_america", label: "Latin America" },
  { value: "usa_canada", label: "USA and Canada" },
] as const;

export const PLATFORM_LANGUAGES = [
  { value: "", label: "Choose one…" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-US", label: "English (United States)" },
] as const;

export const JOB_POSITIONS = [
  { value: "", label: "Choose one…" },
  { value: "owner", label: "Owner / Director" },
  { value: "broker", label: "Broker" },
  { value: "manager", label: "Manager" },
  { value: "compliance", label: "Compliance officer" },
  { value: "other", label: "Other" },
] as const;

export type BusinessNiche = (typeof BUSINESS_NICHES)[number]["value"];
export type BusinessCurrency = (typeof BUSINESS_CURRENCIES)[number]["value"];
export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];
export type BusinessIndustry = (typeof BUSINESS_INDUSTRIES)[number]["value"];
export type RegistrationIdType = (typeof REGISTRATION_ID_TYPES)[number]["value"];
export type OperationRegion = (typeof OPERATION_REGIONS)[number]["value"];
export type PlatformLanguage = (typeof PLATFORM_LANGUAGES)[number]["value"];
export type JobPosition = (typeof JOB_POSITIONS)[number]["value"];

export interface BusinessAuthorizedRep {
  firstName: string;
  lastName: string;
  email: string;
  jobPosition: JobPosition;
  phone: string;
}

export interface BusinessComplianceSettings {
  mergeMessengerContacts: boolean;
  mergeLeadFormContacts: boolean;
  disableContactTimezone: boolean;
  botDetection: boolean;
  verifyEmailOnFirstSend: boolean;
  emailUnsubscribeCompliant: boolean;
  unsubscribeFooter: string;
}

export interface BusinessProfile {
  tradingName: string;
  address: string;
  city: string;
  postcode: string;
  phone: string;
  email: string;
  website: string;
  about: string;
  /** Custom / branded domain hostname (without protocol). */
  brandedDomain: string;
  niche: BusinessNiche;
  /** Free text when niche is Other. Empty for every other niche. */
  nicheDetail: string;
  currency: BusinessCurrency;
  businessType: BusinessType;
  industry: BusinessIndustry;
  registrationIdType: RegistrationIdType;
  registrationNumber: string;
  notRegistered: boolean;
  regionsOfOperation: OperationRegion[];
  platformLanguage: PlatformLanguage;
  outboundLanguage: PlatformLanguage;
  authorizedRep: BusinessAuthorizedRep;
  compliance: BusinessComplianceSettings;
}

export const DEFAULT_UNSUBSCRIBE_FOOTER =
  "If you no longer wish to receive these emails you may unsubscribe.";

export const EMPTY_AUTHORIZED_REP: BusinessAuthorizedRep = {
  firstName: "",
  lastName: "",
  email: "",
  jobPosition: "",
  phone: "",
};

export const EMPTY_COMPLIANCE: BusinessComplianceSettings = {
  mergeMessengerContacts: false,
  mergeLeadFormContacts: false,
  disableContactTimezone: false,
  botDetection: false,
  verifyEmailOnFirstSend: false,
  emailUnsubscribeCompliant: true,
  unsubscribeFooter: DEFAULT_UNSUBSCRIBE_FOOTER,
};

export const EMPTY_BUSINESS: BusinessProfile = {
  tradingName: "",
  address: "",
  city: "",
  postcode: "",
  phone: "",
  email: "",
  website: "",
  about: "",
  brandedDomain: "",
  niche: "",
  nicheDetail: "",
  currency: "",
  businessType: "",
  industry: "",
  registrationIdType: "",
  registrationNumber: "",
  notRegistered: false,
  regionsOfOperation: [],
  platformLanguage: "",
  outboundLanguage: "",
  authorizedRep: { ...EMPTY_AUTHORIZED_REP },
  compliance: { ...EMPTY_COMPLIANCE },
};

function text(value: unknown, max: number) {
  return (typeof value === "string" ? value : "").trim().slice(0, max);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asBool(value: unknown) {
  return value === true;
}

function normalizeRep(raw: unknown): BusinessAuthorizedRep {
  const row =
    raw && typeof raw === "object" ? (raw as Partial<BusinessAuthorizedRep>) : {};
  return {
    firstName: text(row.firstName, 80),
    lastName: text(row.lastName, 80),
    email: text(row.email, 160).toLowerCase(),
    jobPosition: pick(
      row.jobPosition,
      JOB_POSITIONS.map((o) => o.value),
      "",
    ),
    phone: text(row.phone, 20),
  };
}

function normalizeCompliance(raw: unknown): BusinessComplianceSettings {
  const row =
    raw && typeof raw === "object" ? (raw as Partial<BusinessComplianceSettings>) : {};
  return {
    mergeMessengerContacts: asBool(row.mergeMessengerContacts),
    mergeLeadFormContacts: asBool(row.mergeLeadFormContacts),
    disableContactTimezone: asBool(row.disableContactTimezone),
    botDetection: asBool(row.botDetection),
    verifyEmailOnFirstSend: asBool(row.verifyEmailOnFirstSend),
    emailUnsubscribeCompliant:
      row.emailUnsubscribeCompliant === undefined
        ? true
        : asBool(row.emailUnsubscribeCompliant),
    unsubscribeFooter:
      text(row.unsubscribeFooter, 500) || DEFAULT_UNSUBSCRIBE_FOOTER,
  };
}

function normalizeRegions(raw: unknown): OperationRegion[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(OPERATION_REGIONS.map((r) => r.value));
  return [
    ...new Set(
      raw
        .filter((value): value is string => typeof value === "string")
        .filter((value): value is OperationRegion => allowed.has(value as OperationRegion)),
    ),
  ];
}

export function normalizeBusinessProfile(
  input: Partial<BusinessProfile> | null | undefined,
): BusinessProfile {
  const niche = pick(
    input?.niche,
    BUSINESS_NICHES.map((o) => o.value),
    "",
  );
  return {
    tradingName: text(input?.tradingName, 120),
    address: text(input?.address, 160),
    city: text(input?.city, 80),
    postcode: text(input?.postcode, 16),
    phone: text(input?.phone, 20),
    email: text(input?.email, 160).toLowerCase(),
    website: text(input?.website, 200),
    about: text(input?.about, 600),
    brandedDomain: text(input?.brandedDomain, 120)
      .toLowerCase()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, ""),
    niche,
    nicheDetail: niche === "other" ? text(input?.nicheDetail, 80) : "",
    currency: pick(
      input?.currency,
      BUSINESS_CURRENCIES.map((o) => o.value),
      "",
    ),
    businessType: pick(
      input?.businessType,
      BUSINESS_TYPES.map((o) => o.value),
      "",
    ),
    industry: pick(
      input?.industry,
      BUSINESS_INDUSTRIES.map((o) => o.value),
      "",
    ),
    registrationIdType: pick(
      input?.registrationIdType,
      REGISTRATION_ID_TYPES.map((o) => o.value),
      "",
    ),
    registrationNumber: text(input?.registrationNumber, 64),
    notRegistered: asBool(input?.notRegistered),
    regionsOfOperation: normalizeRegions(input?.regionsOfOperation),
    platformLanguage: pick(
      input?.platformLanguage,
      PLATFORM_LANGUAGES.map((o) => o.value),
      "",
    ),
    outboundLanguage: pick(
      input?.outboundLanguage,
      PLATFORM_LANGUAGES.map((o) => o.value),
      "",
    ),
    authorizedRep: normalizeRep(input?.authorizedRep),
    compliance: normalizeCompliance(input?.compliance),
  };
}

function coreFilled(profile: BusinessProfile) {
  return [
    profile.tradingName,
    profile.address,
    profile.city,
    profile.postcode,
    profile.phone,
    profile.email,
    profile.website,
    profile.about,
    profile.brandedDomain,
    profile.niche,
    profile.nicheDetail,
    profile.currency,
    profile.businessType,
    profile.industry,
    profile.registrationNumber,
  ].some((value) => value.trim().length > 0);
}

export function businessProfileFilled(profile: BusinessProfile | undefined) {
  if (!profile) return false;
  if (coreFilled(profile)) return true;
  if (profile.notRegistered || profile.regionsOfOperation.length) return true;
  if (profile.platformLanguage || profile.outboundLanguage) return true;
  const rep = profile.authorizedRep;
  if (rep.firstName || rep.lastName || rep.email || rep.phone || rep.jobPosition) return true;
  const c = profile.compliance;
  if (
    c.mergeMessengerContacts ||
    c.mergeLeadFormContacts ||
    c.disableContactTimezone ||
    c.botDetection ||
    c.verifyEmailOnFirstSend ||
    !c.emailUnsubscribeCompliant ||
    (c.unsubscribeFooter && c.unsubscribeFooter !== DEFAULT_UNSUBSCRIBE_FOOTER)
  ) {
    return true;
  }
  return false;
}

export function readBusinessProfile(raw: unknown): BusinessProfile | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const profile = normalizeBusinessProfile(raw as Partial<BusinessProfile>);
  return businessProfileFilled(profile) ? profile : undefined;
}

export function businessNicheLabel(
  profile: Pick<BusinessProfile, "niche" | "nicheDetail"> | undefined,
) {
  if (!profile?.niche) return "";
  if (profile.niche === "other") return profile.nicheDetail.trim() || "Other";
  return BUSINESS_NICHES.find((option) => option.value === profile.niche)?.label || "";
}

export function defaultCurrencyForMarket(market: "uk" | "us"): BusinessCurrency {
  return market === "us" ? "USD" : "GBP";
}

export function defaultLanguageForMarket(market: "uk" | "us"): PlatformLanguage {
  return market === "us" ? "en-US" : "en-GB";
}

export function validateBusinessProfile(
  input: Partial<BusinessProfile>,
): { ok: true; value: BusinessProfile } | { ok: false; error: string } {
  const value = normalizeBusinessProfile(input);
  if (value.tradingName.length < 2) {
    return { ok: false, error: "Trading name must be at least 2 characters" };
  }
  if (value.niche === "other" && value.nicheDetail.length < 2) {
    return { ok: false, error: "Specify the business niche." };
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
  if (value.brandedDomain) {
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(value.brandedDomain)) {
      return { ok: false, error: "Branded domain should look like agency.example.com" };
    }
  }
  if (
    value.authorizedRep.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.authorizedRep.email)
  ) {
    return { ok: false, error: "Representative email looks incomplete." };
  }
  if (
    value.authorizedRep.phone &&
    !/^\+[1-9]\d{7,14}$/.test(value.authorizedRep.phone)
  ) {
    return { ok: false, error: "Add the representative phone with the country code." };
  }
  if (value.notRegistered) {
    value.registrationNumber = "";
    value.registrationIdType = "";
  }
  return { ok: true, value };
}

/** Footer text used on marketing email when compliance is enabled. */
export function resolveUnsubscribeFooter(profile: BusinessProfile | undefined) {
  const compliance = profile?.compliance || EMPTY_COMPLIANCE;
  if (!compliance.emailUnsubscribeCompliant) return "";
  const footer = (compliance.unsubscribeFooter || DEFAULT_UNSUBSCRIBE_FOOTER).trim();
  const name = profile?.tradingName?.trim();
  if (name && !footer.toLowerCase().includes(name.toLowerCase())) {
    return `${footer} ${name}`.trim();
  }
  return footer;
}

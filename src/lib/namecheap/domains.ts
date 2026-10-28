import { elementsNamed, parseNamecheapXml } from "@/lib/namecheap/xml";
import { apexARecord, cleanHost, cnameTarget, isApexHost } from "@/lib/website/domain-records";

const MULTI_TLDS = ["co.uk", "org.uk", "me.uk", "com.au", "net.au", "org.au", "co.nz", "co.za"];
const COMPANY_LEGAL_TYPES = new Set(["LTD", "PLC", "LLP", "RCHAR"]);
const CALLING_CODES = ["353", "44", "61", "64", "27", "1"];

export type DomainMarket = "uk" | "us";

export interface DomainQuote {
  domain: string;
  available: boolean;
  premium: boolean;
  price: number | null;
  currency: string;
}

export interface NamecheapHost {
  name: string;
  type: string;
  address: string;
  mxPref?: string;
  ttl?: string;
}

export interface RegistrantContact {
  firstName: string;
  lastName: string;
  organization: string;
  address: string;
  city: string;
  postcode: string;
  phone: string;
  email: string;
  country: "GB" | "US";
}

interface NamecheapConfig {
  endpoint: string;
  apiUser: string;
  apiKey: string;
  userName: string;
  clientIp: string;
}

const priceCache = new Map<string, { amount: number; currency: string; at: number }>();

export function isNamecheapConfigured() {
  return namecheapConfig() !== null;
}

export function namecheapConfig(): NamecheapConfig | null {
  const apiUser = (process.env.NAMECHEAP_API_USER || "").trim();
  const apiKey = (process.env.NAMECHEAP_API_KEY || "").trim();
  const clientIp = (process.env.NAMECHEAP_CLIENT_IP || "").trim();
  if (!apiUser || !apiKey || !clientIp) return null;
  const sandbox = /^(1|true|yes)$/i.test((process.env.NAMECHEAP_SANDBOX || "").trim());
  return {
    endpoint: sandbox
      ? "https://api.sandbox.namecheap.com/xml.response"
      : "https://api.namecheap.com/xml.response",
    apiUser,
    apiKey,
    userName: (process.env.NAMECHEAP_USERNAME || apiUser).trim(),
    clientIp,
  };
}

export function publicNamecheapError(message: string) {
  if (/api\s*key|client\s*ip|whitelist|not authorized|invalid request ip|authentication/i.test(message)) {
    return "Domain buying isn’t available yet.";
  }
  return message.replace(/\s+/g, " ").trim() || "That domain request didn’t go through.";
}

export function splitRegistrableDomain(raw: string): { sld: string; tld: string; domain: string } | null {
  const host = cleanHost(raw).replace(/^www\./, "");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) {
    return null;
  }
  for (const tld of MULTI_TLDS) {
    if (host.endsWith(`.${tld}`)) {
      const sld = host.slice(0, -(tld.length + 1));
      if (!sld || sld.includes(".")) return null;
      return { sld, tld, domain: `${sld}.${tld}` };
    }
  }
  const parts = host.split(".");
  if (parts.length !== 2) return null;
  return { sld: parts[0], tld: parts[1], domain: host };
}

export function domainCandidates(query: string, market: DomainMarket): string[] {
  const cleaned = cleanHost(query).replace(/^www\./, "");
  if (!cleaned) return [];
  if (cleaned.includes(".")) {
    const exact = splitRegistrableDomain(cleaned);
    return exact ? [exact.domain] : [];
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(cleaned)) return [];
  const tlds = market === "us" ? ["com", "net", "co"] : ["co.uk", "uk", "com"];
  return tlds.map((tld) => `${cleaned}.${tld}`);
}

export function registrantFromProfile(input: {
  fullName: string;
  organization: string;
  address: string;
  city: string;
  postcode: string;
  phone: string;
  email: string;
  country: "GB" | "US";
}): RegistrantContact {
  const parts = input.fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) throw new Error("Add your name in Workspace before buying a domain.");
  if (!input.address.trim() || !input.city.trim() || !input.postcode.trim()) {
    throw new Error("Add the business address in Workspace before buying a domain.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    throw new Error("Add a business email in Workspace before buying a domain.");
  }
  if (!namecheapPhone(input.phone)) {
    throw new Error("Add a business phone with the country code before buying a domain.");
  }
  return {
    firstName: parts[0].slice(0, 80),
    lastName: (parts.length > 1 ? parts.slice(1).join(" ") : parts[0]).slice(0, 80),
    organization: input.organization.trim().slice(0, 120),
    address: input.address.trim().slice(0, 160),
    city: input.city.trim().slice(0, 50),
    postcode: input.postcode.trim().slice(0, 16),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    country: input.country,
  };
}

export function namecheapPhone(e164: string): string | null {
  const digits = e164.trim().replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) return null;
  const rest = digits.slice(1);
  const code = CALLING_CODES.find((item) => rest.startsWith(item) && rest.length - item.length >= 4);
  if (!code) return null;
  return `+${code}.${rest.slice(code.length)}`;
}

export function ukExtendedAttributes(
  tld: string,
  legalType: string,
  registeredFor: string,
  companyId?: string,
): Record<string, string> {
  const needsCompany = COMPANY_LEGAL_TYPES.has(legalType);
  if (tld === "uk") {
    return {
      UKLegalType: legalType,
      UKRegisteredfor: registeredFor,
      ...(needsCompany && companyId ? { UKCompanyID: companyId } : {}),
    };
  }
  if (tld.endsWith(".uk") || tld === "co.uk" || tld === "org.uk" || tld === "me.uk") {
    return {
      COUKLegalType: legalType,
      COUKRegisteredfor: registeredFor,
      ...(needsCompany && companyId ? { COUKCompanyID: companyId } : {}),
    };
  }
  return {};
}

export function websiteHostRecords(): NamecheapHost[] {
  return [
    { name: "@", type: "A", address: apexARecord(), ttl: "1800" },
    { name: "www", type: "CNAME", address: cnameTarget(), ttl: "1800" },
  ];
}

const REPLACED = new Set(["A", "AAAA", "CNAME", "ALIAS", "URL", "URL301", "FRAME"]);

export function mergeWebsiteHosts(existing: NamecheapHost[]): NamecheapHost[] {
  const kept = existing.filter((host) => {
    const name = host.name.toLowerCase();
    const type = host.type.toUpperCase();
    if ((name === "@" || name === "www") && REPLACED.has(type)) return false;
    return true;
  });
  const wanted = websiteHostRecords();
  const present = new Set(kept.map((host) => `${host.name.toLowerCase()} ${host.type.toUpperCase()}`));
  for (const host of wanted) {
    const key = `${host.name.toLowerCase()} ${host.type.toUpperCase()}`;
    if (!present.has(key)) kept.push(host);
  }
  return kept;
}

function money(value: string | undefined): number | null {
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function quotesFromCheckXml(xml: string, prices: Map<string, { amount: number; currency: string }>): DomainQuote[] {
  return elementsNamed(xml, "DomainCheckResult").map((row) => {
    const domain = (row.Domain || "").toLowerCase();
    const premium = /^true$/i.test(row.IsPremiumName || "");
    const tld = splitRegistrableDomain(domain)?.tld || "";
    const standard = prices.get(tld);
    const premiumPrice = money(row.PremiumRegistrationPrice);
    return {
      domain,
      available: /^true$/i.test(row.Available || ""),
      premium,
      price: premium ? premiumPrice : standard?.amount ?? null,
      currency: premium ? "USD" : standard?.currency || "USD",
    };
  });
}

export function hostsFromGetXml(xml: string): { ourDns: boolean; hosts: NamecheapHost[] } {
  const root = elementsNamed(xml, "DomainDNSGetHostsResult")[0];
  const hosts = elementsNamed(xml, "Host").map((row) => ({
    name: row.Name || "@",
    type: (row.Type || "A").toUpperCase(),
    address: row.Address || "",
    mxPref: row.MXPref,
    ttl: row.TTL,
  }));
  return { ourDns: !root || /^true$/i.test(root.IsUsingOurDNS || "true"), hosts };
}

export function registerPriceFromXml(xml: string, tld: string): { amount: number; currency: string } | null {
  const products = [...xml.matchAll(/<Product\b([^>]*)>([\s\S]*?)<\/Product>/gi)];
  for (const product of products) {
    const name = tagName(product[1]);
    if (name !== tld) continue;
    const prices = [...product[2].matchAll(/<Price\b([^>]*)\/?>/gi)].map((match) => tagAttributesSafe(match[1]));
    const year = prices.find((price) => price.Duration === "1" && /year/i.test(price.DurationType || "YEAR"));
    const amount = money(year?.YourPrice || year?.Price);
    if (!year || amount === null) continue;
    return { amount, currency: year.Currency || "USD" };
  }
  return null;
}

function tagName(attrs: string) {
  return tagAttributesSafe(attrs).Name?.toLowerCase() || "";
}

function tagAttributesSafe(fragment: string) {
  const attrs: Record<string, string> = {};
  for (const match of fragment.matchAll(/([A-Za-z0-9_]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

async function callNamecheap(command: string, params: Record<string, string>, timeoutMs = 20000) {
  const config = namecheapConfig();
  if (!config) throw new Error("Domain buying isn’t available yet.");
  const body = new URLSearchParams({
    ApiUser: config.apiUser,
    ApiKey: config.apiKey,
    UserName: config.userName,
    ClientIp: config.clientIp,
    Command: command,
    ...params,
  });
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const xml = await response.text();
  const parsed = parseNamecheapXml(xml);
  if (parsed.status !== "OK") {
    throw new Error(publicNamecheapError(parsed.errors[0] || "That domain request didn’t go through."));
  }
  return xml;
}

async function priceFor(tld: string) {
  const cached = priceCache.get(tld);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) {
    return { amount: cached.amount, currency: cached.currency };
  }
  try {
    const xml = await callNamecheap("namecheap.users.getPricing", {
      ProductType: "DOMAIN",
      ProductCategory: "DOMAINS",
      ActionName: "REGISTER",
      ProductName: tld,
    });
    const price = registerPriceFromXml(xml, tld);
    if (!price) return null;
    priceCache.set(tld, { ...price, at: Date.now() });
    return price;
  } catch {
    return null;
  }
}

export async function searchDomains(query: string, market: DomainMarket): Promise<DomainQuote[]> {
  const domains = domainCandidates(query, market);
  if (!domains.length) throw new Error("Enter a name such as northbridge or northbridge.co.uk.");
  const xml = await callNamecheap("namecheap.domains.check", { DomainList: domains.join(",") });
  const tlds = [...new Set(domains.map((domain) => splitRegistrableDomain(domain)?.tld || "").filter(Boolean))];
  const priced = await Promise.all(tlds.map(async (tld) => [tld, await priceFor(tld)] as const));
  const prices = new Map<string, { amount: number; currency: string }>();
  for (const [tld, price] of priced) {
    if (price) prices.set(tld, price);
  }
  const quotes = quotesFromCheckXml(xml, prices);
  const order = new Map(domains.map((domain, index) => [domain, index]));
  return quotes.sort((a, b) => (order.get(a.domain) ?? 0) - (order.get(b.domain) ?? 0));
}

function contactParams(prefix: string, contact: RegistrantContact, phone: string): Record<string, string> {
  return {
    [`${prefix}FirstName`]: contact.firstName,
    [`${prefix}LastName`]: contact.lastName,
    [`${prefix}OrganizationName`]: contact.organization,
    [`${prefix}Address1`]: contact.address,
    [`${prefix}City`]: contact.city,
    [`${prefix}StateProvince`]: contact.city,
    [`${prefix}PostalCode`]: contact.postcode,
    [`${prefix}Country`]: contact.country,
    [`${prefix}Phone`]: phone,
    [`${prefix}EmailAddress`]: contact.email,
  };
}

export function registrationParams(
  contact: RegistrantContact,
  domain: string,
  options?: { legalType?: string; companyId?: string; premiumPrice?: number },
): Record<string, string> {
  const parts = splitRegistrableDomain(domain);
  if (!parts) throw new Error("Enter a domain such as northbridge.co.uk.");
  const phone = namecheapPhone(contact.phone);
  if (!phone) throw new Error("Add a business phone with the country code before buying a domain.");
  const legalType = options?.legalType || "IND";
  if (COMPANY_LEGAL_TYPES.has(legalType) && !options?.companyId?.trim()) {
    throw new Error("A company number is required for that registrant type.");
  }
  const registeredFor = contact.organization || `${contact.firstName} ${contact.lastName}`.trim();
  return {
    DomainName: parts.domain,
    Years: "1",
    AddFreeWhoisguard: "yes",
    WGEnabled: "yes",
    ...contactParams("Registrant", contact, phone),
    ...contactParams("Tech", contact, phone),
    ...contactParams("Admin", contact, phone),
    ...contactParams("AuxBilling", contact, phone),
    ...ukExtendedAttributes(parts.tld, legalType, registeredFor, options?.companyId?.trim()),
    ...(options?.premiumPrice
      ? { IsPremiumDomain: "true", PremiumPrice: String(options.premiumPrice) }
      : {}),
  };
}

function hostParams(hosts: NamecheapHost[]) {
  const params: Record<string, string> = {};
  hosts.forEach((host, index) => {
    const n = index + 1;
    params[`HostName${n}`] = host.name;
    params[`RecordType${n}`] = host.type;
    params[`Address${n}`] = host.address;
    params[`TTL${n}`] = host.ttl || "1800";
    if (host.type.toUpperCase() === "MX") params[`MXPref${n}`] = host.mxPref || "10";
  });
  if (hosts.some((host) => host.type.toUpperCase() === "MX")) params.EmailType = "MX";
  return params;
}

export async function pointDomainAtWebsite(domain: string) {
  const parts = splitRegistrableDomain(domain);
  if (!parts || !isApexHost(parts.domain)) {
    throw new Error("Enter the domain itself, such as northbridge.co.uk, not a page on it.");
  }
  const currentXml = await callNamecheap("namecheap.domains.dns.getHosts", {
    SLD: parts.sld,
    TLD: parts.tld,
  });
  const current = hostsFromGetXml(currentXml);
  if (!current.ourDns) {
    throw new Error("This domain uses other nameservers. Add the website records at that DNS host, or switch the domain to Namecheap DNS and connect again.");
  }
  const hosts = mergeWebsiteHosts(current.hosts.filter((host) => host.address));
  const xml = await callNamecheap("namecheap.domains.dns.setHosts", {
    SLD: parts.sld,
    TLD: parts.tld,
    ...hostParams(hosts),
  });
  const result = elementsNamed(xml, "DomainDNSSetHostsResult")[0];
  if (result && /^false$/i.test(result.IsSuccess || "")) {
    throw new Error("The domain was found, but the website records could not be saved.");
  }
  return parts.domain;
}

export async function buyDomain(
  contact: RegistrantContact,
  domain: string,
  options?: { legalType?: string; companyId?: string; expectedPrice?: number },
) {
  const parts = splitRegistrableDomain(domain);
  if (!parts) throw new Error("Enter a domain such as northbridge.co.uk.");
  const checked = await callNamecheap("namecheap.domains.check", { DomainList: parts.domain });
  const quote = quotesFromCheckXml(checked, new Map())[0];
  if (!quote?.available) throw new Error("That domain isn’t available.");
  if (quote.premium) {
    throw new Error("Premium domains can’t be bought here. Choose a standard domain.");
  }
  const standard = await priceFor(parts.tld);
  if (!standard) throw new Error("We couldn’t confirm the price for that domain. Try again shortly.");
  const maxPrice = Number(process.env.NAMECHEAP_MAX_PRICE || 60);
  if (standard.amount > maxPrice) {
    throw new Error("That domain is above the price limit. Choose another extension.");
  }
  if (
    typeof options?.expectedPrice !== "number" ||
    Math.abs(options.expectedPrice - standard.amount) > 0.01
  ) {
    throw new Error("The price changed. Search again to see the current price before buying.");
  }
  const params = registrationParams(contact, parts.domain, {
    legalType: options?.legalType,
    companyId: options?.companyId,
  });
  let xml: string;
  try {
    xml = await callNamecheap("namecheap.domains.create", params, 45000);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/privacy|whoisguard/i.test(message)) throw error;
    xml = await callNamecheap(
      "namecheap.domains.create",
      { ...params, AddFreeWhoisguard: "no", WGEnabled: "no" },
      45000,
    );
  }
  const created = elementsNamed(xml, "DomainCreateResult")[0];
  if (!created || /^false$/i.test(created.Registered || "")) {
    throw new Error("The domain was not registered.");
  }
  let dnsReady = true;
  let dnsError = "";
  try {
    await pointDomainAtWebsite(created.Domain || parts.domain);
  } catch (error) {
    dnsReady = false;
    dnsError = error instanceof Error ? error.message : "The website records could not be saved yet.";
  }
  return {
    domain: (created.Domain || parts.domain).toLowerCase(),
    chargedAmount: money(created.ChargedAmount),
    currency: standard.currency || "USD",
    dnsReady,
    dnsError,
  };
}

export function requiresCompanyNumber(legalType: string) {
  return COMPANY_LEGAL_TYPES.has(legalType);
}

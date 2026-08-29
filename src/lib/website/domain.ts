import dns from "node:dns/promises";
import tls from "node:tls";
import { normalizeHost } from "@/lib/website/slug";
import {
  apexARecord,
  cleanHost,
  cnameTarget,
  dnsInstructions,
  isApexHost,
  type DnsInstruction,
} from "@/lib/website/domain-records";

export {
  apexARecord,
  cleanHost,
  cnameTarget,
  dnsInstructions,
  isApexHost,
  type DnsInstruction,
};

const VERCEL_APEX_IPS = [
  apexARecord(),
  ...(process.env.WEBSITE_APEX_IPS || "76.76.21.21,76.76.21.22")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean),
];

function acceptedCnameTargets(): string[] {
  return [...new Set([cnameTarget(), "cname.vercel-dns.com", "sites.0nestate.app"])];
}

function stripDot(value: string) {
  return value.toLowerCase().replace(/\.$/, "");
}

async function cnameChain(host: string, depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  try {
    const records = await dns.resolveCname(host);
    const names = records.map(stripDot);
    const nested = await Promise.all(names.map((name) => cnameChain(name, depth + 1)));
    return [...names, ...nested.flat()];
  } catch {
    return [];
  }
}

function cnameMatches(names: string[]): boolean {
  const targets = acceptedCnameTargets();
  return names.some(
    (name) =>
      targets.includes(name) ||
      name.endsWith(".vercel-dns.com") ||
      targets.some((t) => name === t || name.endsWith(`.${t}`)),
  );
}

async function aRecordsMatch(host: string): Promise<boolean> {
  try {
    const records = await dns.resolve4(host);
    return records.some((ip) => VERCEL_APEX_IPS.includes(ip));
  } catch {
    return false;
  }
}

export async function probeTls(host: string): Promise<{
  ok: boolean;
  authorized: boolean;
  expiresAt?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, timeout: 8000, rejectUnauthorized: false },
      () => {
        const authorized = socket.authorized;
        const cert = socket.getPeerCertificate();
        socket.end();
        resolve({
          ok: Boolean(authorized && cert),
          authorized: Boolean(authorized),
          expiresAt: cert?.valid_to,
        });
      },
    );
    socket.on("error", (err) =>
      resolve({ ok: false, authorized: false, error: err.message }),
    );
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, authorized: false, error: "TLS probe timed out" });
    });
  });
}

export type DomainCheckStatus = "connected" | "pending" | "failed";
export type DomainSslStatus = "none" | "provisioning" | "active" | "error";

export interface DomainCheck {
  host: string;
  lookupHost: string;
  apex: boolean;
  dnsOk: boolean;
  cname: string[];
  status: DomainCheckStatus;
  ssl: DomainSslStatus;
  message: string;
  instructions: DnsInstruction[];
  vercel?: { attached: boolean; verified?: boolean; detail?: string };
}

export async function checkCustomDomain(rawDomain: string): Promise<DomainCheck> {
  const typed = cleanHost(rawDomain);
  const host = normalizeHost(typed);
  const instructions = dnsInstructions(typed);
  const apex = isApexHost(typed) || isApexHost(host);
  const target = cnameTarget();

  if (!host || typed.includes(" ") || !host.includes(".")) {
    return {
      host,
      lookupHost: typed || host,
      apex,
      dnsOk: false,
      cname: [],
      status: "failed",
      ssl: "none",
      message: "Enter a valid domain (e.g. agency.com or www.agency.com).",
      instructions,
    };
  }

  const lookupHosts = [...new Set([typed, host, `www.${host}`].filter(Boolean))];
  const chains = await Promise.all(lookupHosts.map((h) => cnameChain(h)));
  const cname = chains.flat();
  const aOk = await aRecordsMatch(host);
  const matchedHost =
    lookupHosts.find((h, i) => cnameMatches(chains[i])) || (aOk ? host : "");
  const dnsOk = Boolean(matchedHost);

  if (!dnsOk) {
    let resolves = false;
    try {
      await dns.resolve(typed || host);
      resolves = true;
    } catch {
      resolves = false;
    }
    return {
      host,
      lookupHost: typed || host,
      apex,
      dnsOk: false,
      cname,
      status: "pending",
      ssl: "none",
      message: resolves
        ? `${typed || host} resolves, but it does not point at ${target} yet. Add the record below and wait for DNS (often a few minutes, up to 48h).`
        : `${typed || host} does not resolve yet. Add the DNS record below at your registrar, then verify again.`,
      instructions,
    };
  }

  const tlsHost = matchedHost || typed || host;
  const tlsResult = await probeTls(tlsHost);
  const ssl: DomainSslStatus = tlsResult.authorized ? "active" : "provisioning";

  return {
    host,
    lookupHost: tlsHost,
    apex,
    dnsOk: true,
    cname,
    status: "connected",
    ssl,
    message: tlsResult.authorized
      ? `DNS verified and HTTPS is live on ${tlsHost}.`
      : `DNS verified — ${tlsHost} points at ${target}. HTTPS will activate once the certificate is issued (usually a few minutes).`,
    instructions,
  };
}

export async function attachVercelDomain(host: string): Promise<{
  attached: boolean;
  verified?: boolean;
  detail?: string;
} | null> {
  const token = process.env.VERCEL_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  if (!token || !project) return null;

  const team = process.env.VERCEL_TEAM_ID;
  const qs = team ? `?teamId=${encodeURIComponent(team)}` : "";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const add = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/domains${qs}`,
    { method: "POST", headers, body: JSON.stringify({ name: host }) },
  );
  const addJson = (await add.json().catch(() => ({}))) as {
    error?: { message?: string; code?: string };
    verified?: boolean;
  };
  if (!add.ok && add.status !== 409) {
    return {
      attached: false,
      detail: addJson.error?.message || `Vercel rejected the domain (${add.status})`,
    };
  }

  const get = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(host)}${qs}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const getJson = (await get.json().catch(() => ({}))) as {
    verified?: boolean;
    error?: { message?: string };
  };
  return {
    attached: true,
    verified: Boolean(getJson.verified ?? addJson.verified),
    detail: getJson.error?.message,
  };
}

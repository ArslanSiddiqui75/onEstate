export interface NamecheapXml {
  status: "OK" | "ERROR";
  errors: string[];
  raw: string;
}

export function tagAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([A-Za-z0-9_]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

export function parseNamecheapXml(xml: string): NamecheapXml {
  const statusMatch = xml.match(/<ApiResponse\b[^>]*\bStatus="(OK|ERROR)"/i);
  const errors = [...xml.matchAll(/<Error\b[^>]*>([^<]*)<\/Error>/gi)]
    .map((match) => match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&quot;/g, '"').trim())
    .filter(Boolean);
  return {
    status: statusMatch?.[1].toUpperCase() === "OK" ? "OK" : "ERROR",
    errors,
    raw: xml,
  };
}

export function elementsNamed(xml: string, name: string): Array<Record<string, string>> {
  const pattern = new RegExp(`<${name}\\b([^>]*)\\/?>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => tagAttributes(match[1]));
}

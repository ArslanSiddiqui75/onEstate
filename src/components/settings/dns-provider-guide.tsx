"use client";

type GuideKind = "website" | "email";

const PROVIDERS = [
  {
    id: "hostinger",
    name: "Hostinger",
    path: "hPanel → Domains → Manage → DNS / DNS Zone Editor",
  },
  {
    id: "godaddy",
    name: "GoDaddy",
    path: "My Products → DNS → Manage DNS",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    path: "Domain → DNS → Records",
  },
  {
    id: "namecheap",
    name: "Namecheap",
    path: "Domain List → Manage → Advanced DNS",
  },
  {
    id: "google",
    name: "Google Domains / Squarespace",
    path: "DNS → Custom records",
  },
] as const;

export function DnsProviderGuide({ kind }: { kind: GuideKind }) {
  const isWebsite = kind === "website";

  return (
    <details className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-muted)]/60 open:bg-[var(--surface)]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Already own the domain? How to point it here
        <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">
          Hostinger, GoDaddy, Cloudflare, Namecheap, and similar DNS panels
        </span>
      </summary>

      <div className="space-y-4 border-t border-[var(--border)] px-4 py-4 text-sm leading-relaxed text-[var(--muted)]">
        <ol className="list-decimal space-y-3 pl-5 text-[var(--foreground)]">
          <li>
            Sign in where the domain is managed — for Hostinger that is{" "}
            <strong className="font-medium">hPanel</strong>. You do not need to move the domain
            away from them.
          </li>
          <li>
            Open the DNS editor for that domain:
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[var(--muted)]">
              {PROVIDERS.map((provider) => (
                <li key={provider.id}>
                  <span className="font-medium text-[var(--foreground)]">{provider.name}:</span>{" "}
                  {provider.path}
                </li>
              ))}
            </ul>
          </li>
          <li>
            {isWebsite ? (
              <>
                Add the <strong className="font-medium">A</strong> and/or{" "}
                <strong className="font-medium">CNAME</strong> records shown above. If Hostinger
                already has an A record on <code className="text-xs">@</code> or a CNAME on{" "}
                <code className="text-xs">www</code>, edit that row instead of creating a
                duplicate.
              </>
            ) : (
              <>
                Add every <strong className="font-medium">CNAME</strong> and{" "}
                <strong className="font-medium">TXT</strong> record listed in this page. Copy each
                value exactly — Hostinger’s host field usually wants only the left label (for
                example <code className="text-xs">mail</code> or{" "}
                <code className="text-xs">s1._domainkey</code>), not the full domain.
              </>
            )}
          </li>
          <li>
            {isWebsite ? (
              <>
                Save the zone, wait a few minutes (sometimes up to a few hours), then press{" "}
                <strong className="font-medium">Verify DNS</strong> here. Publish the website in
                the app or the domain will still show a 404.
              </>
            ) : (
              <>
                Save the zone, wait for DNS to update, then press{" "}
                <strong className="font-medium">Check DNS</strong> here. When it passes,
                Conversations will send from your brokerage address.
              </>
            )}
          </li>
        </ol>

        {isWebsite ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-xs">
            <p className="font-medium text-[var(--foreground)]">Keep Hostinger email working</p>
            <p className="mt-1">
              Pointing the website here does not move your mailbox. Leave Hostinger{" "}
              <strong className="font-medium">MX</strong> records alone unless you are also
              connecting email in Phone System → Email domain.
            </p>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-xs">
            <p className="font-medium text-[var(--foreground)]">If Hostinger already hosts your email</p>
            <ul className="list-disc space-y-1.5 pl-4">
              <li>
                Do <strong className="font-medium">not</strong> delete existing MX records if staff
                still read mail in Hostinger webmail or Outlook.
              </li>
              <li>
                If an SPF TXT already exists on the root domain, merge it: keep Hostinger’s{" "}
                <code className="text-[11px]">include:…</code> and add the app’s{" "}
                <code className="text-[11px]">include:</code> from the record list. One SPF row
                only — two SPF records will fail.
              </li>
              <li>
                DKIM and the <code className="text-[11px]">mail.</code> CNAME are new names, so they
                usually do not clash with Hostinger’s own records.
              </li>
            </ul>
          </div>
        )}

        <p className="text-xs">
          DNS changes are at your registrar. We only check that the records resolve correctly —
          we never need your Hostinger password.
        </p>
      </div>
    </details>
  );
}

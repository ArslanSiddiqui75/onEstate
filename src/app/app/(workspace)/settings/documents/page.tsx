"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

type Doc = {
  id: string;
  title: string;
  kind: string;
  href: string | null;
  createdAt: string;
  meta?: string;
};

export default function AppDocumentsPage() {
  const { user, org, getAuthToken } = useAppSession();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) {
      setDocs([]);
      return;
    }
    try {
      const res = await fetch("/api/documents", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setDocs([]);
        return;
      }
      const json = (await res.json()) as { documents?: Doc[] };
      setDocs(json.documents || []);
    } catch {
      setDocs([]);
    }
  }, [getAuthToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user || !org) return null;
  const canView =
    hasModuleAccess(user, org.plan, "crm", "view") ||
    hasModuleAccess(user, org.plan, "listings", "view") ||
    hasModuleAccess(user, org.plan, "transactions", "view");
  if (!canView) {
    return (
      <LockedModule
        title="Documents locked"
        reason="Documents follow CRM, listings, or deals access."
        role={user.role}
        moduleAccess={user.moduleAccess}
        plan={org.plan}
      />
    );
  }
  const canEdit =
    hasModuleAccess(user, org.plan, "crm", "edit") ||
    hasModuleAccess(user, org.plan, "listings", "edit") ||
    hasModuleAccess(user, org.plan, "transactions", "edit");

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        {canEdit
          ? "Upload a file, or open e-sign files and listing media from this workspace."
          : "E-sign files and listing media for this workspace. Uploading needs edit access."}
      </p>
      {canEdit ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) {
              toast.error("Choose a file");
              return;
            }
            void (async () => {
              setBusy(true);
              try {
                const token = await getAuthToken();
                const headers: Record<string, string> = {
                  "Content-Type": "application/json",
                };
                if (token) headers.Authorization = `Bearer ${token}`;
                const signed = await fetch("/api/documents/upload", {
                  method: "POST",
                  headers,
                  body: JSON.stringify({
                    fileName: file.name,
                    mimeType: file.type,
                    sizeBytes: file.size,
                  }),
                });
                const upload = (await signed.json()) as {
                  path?: string;
                  token?: string;
                  signedUrl?: string;
                  error?: string;
                };
                if (!signed.ok || !upload.path || !upload.token || !upload.signedUrl) {
                  throw new Error(upload.error || "Could not start upload");
                }
                const put = await fetch(upload.signedUrl, {
                  method: "PUT",
                  headers: {
                    "Content-Type": file.type || "application/octet-stream",
                    "x-upsert": "false",
                  },
                  body: file,
                });
                if (!put.ok) throw new Error("Upload failed");
                const save = await fetch("/api/documents", {
                  method: "POST",
                  headers,
                  body: JSON.stringify({
                    title: title.trim() || file.name,
                    path: upload.path,
                    mimeType: file.type,
                  }),
                });
                if (!save.ok) {
                  const json = (await save.json().catch(() => null)) as { error?: string } | null;
                  throw new Error(json?.error || "Could not save document");
                }
                setTitle("");
                setFile(null);
                toast.success("Document uploaded");
                await load();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Upload failed");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <Input
            className="max-w-xs"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </form>
      ) : null}
      <div className="space-y-2">
        {docs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No documents yet.</p>
        ) : (
          docs.map((doc) => (
            <Card key={doc.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="font-medium">{doc.title}</p>
                <p className="text-xs text-[var(--muted)]">
                  {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="capitalize">{doc.kind}</Badge>
                {doc.href ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void (async () => {
                        if (doc.kind === "listing") {
                          const href = doc.href || "";
                          if (/^https?:\/\//i.test(href)) {
                            window.open(href, "_blank", "noopener,noreferrer");
                          }
                          return;
                        }
                        const token = await getAuthToken();
                        const res = await fetch(
                          `/api/documents/sign?path=${encodeURIComponent(doc.href || "")}`,
                          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                        );
                        const json = (await res.json().catch(() => null)) as {
                          url?: string;
                          error?: string;
                        } | null;
                        if (!res.ok || !json?.url) {
                          toast.error(json?.error || "Could not open file");
                          return;
                        }
                        try {
                          const target = new URL(json.url);
                          const local =
                            target.protocol === "http:" &&
                            (target.hostname === "localhost" || target.hostname === "127.0.0.1");
                          if (target.protocol === "https:" || local) {
                            window.open(target.href, "_blank", "noopener,noreferrer");
                          }
                        } catch {
                          toast.error("Could not open file");
                        }
                      })();
                    }}
                  >
                    Open
                  </Button>
                ) : (
                  <span className="text-xs text-[var(--muted)]">{doc.meta || "In deals"}</span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

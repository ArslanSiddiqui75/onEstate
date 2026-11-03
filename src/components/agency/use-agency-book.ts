"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyAgencyInbox, seedAgencyBook } from "@/lib/agency/book";
import { publishMissingPortals } from "@/lib/agency/publish-client";
import { loadAgencyBook, saveAgencyBook } from "@/lib/agency/store";
import type { AgencyBook, AgencyInbox } from "@/lib/agency/types";
import { useAppSession } from "@/lib/app/session";
import { toast } from "@/components/ui/toast";

async function fetchHostedBook(
  getAuthToken: () => Promise<string | null>,
): Promise<{ book: AgencyBook; updatedAt: string } | null> {
  const token = await getAuthToken();
  if (!token) return null;
  const res = await fetch("/api/agency/book", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    available?: boolean;
    book?: AgencyBook;
    updatedAt?: string | null;
  };
  if (!json.available || !json.book || !json.updatedAt) return null;
  return { book: json.book, updatedAt: json.updatedAt };
}

async function putHostedBook(
  getAuthToken: () => Promise<string | null>,
  book: AgencyBook,
  expectedUpdatedAt: string | null,
): Promise<{ book: AgencyBook; updatedAt: string }> {
  const token = await getAuthToken();
  if (!token) throw new Error("Sign in required");
  const res = await fetch("/api/agency/book", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...book, expectedUpdatedAt }),
  });
  const json = (await res.json().catch(() => null)) as
    | { book?: AgencyBook; updatedAt?: string; error?: string }
    | null;
  if (res.status === 409) {
    throw new Error(json?.error || "This was updated elsewhere. Refresh and try again.");
  }
  if (!res.ok || !json?.book || !json.updatedAt) {
    throw new Error(json?.error || "Could not save the diary");
  }
  return { book: json.book, updatedAt: json.updatedAt };
}

export function useAgencyBook(orgId: string) {
  const { persistence, getAuthToken } = useAppSession();
  const [book, setBook] = useState<AgencyBook>(() => seedAgencyBook());
  const [ready, setReady] = useState(false);
  const updatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const refresh = () => {
      void (async () => {
        if (persistence === "supabase") {
          try {
            const hosted = await fetchHostedBook(getAuthToken);
            if (!cancel && hosted) {
              updatedAtRef.current = hosted.updatedAt;
              setBook(hosted.book);
              setReady(true);
              return;
            }
          } catch {
            // Fall through to the local copy if the hosted book is unavailable.
          }
        }

        let next = loadAgencyBook(orgId);
        try {
          const res = await fetch("/api/agency");
          if (res.ok) {
            const json = (await res.json()) as Partial<AgencyInbox> & {
              available?: boolean;
            };
            if (json.available === false) {
              if (!cancel) {
                setBook(next);
                setReady(true);
              }
              return;
            }
            const merged = applyAgencyInbox(next, {
              appointments: json.appointments ?? [],
              offers: json.offers ?? [],
              approvals: json.approvals ?? [],
              portals: json.portals ?? [],
            });
            if (JSON.stringify(merged.book) !== JSON.stringify(next)) {
              saveAgencyBook(orgId, merged.book);
              next = merged.book;
            }
            void publishMissingPortals(
              next.portals,
              (json.portals ?? []).map((portal) => portal.token),
            );
          }
        } catch {
          // The office inbox is optional in local mode.
        }
        if (!cancel) {
          setBook(next);
          setReady(true);
        }
      })();
    };
    const id = window.setTimeout(refresh, 0);
    window.addEventListener("focus", refresh);
    return () => {
      cancel = true;
      window.clearTimeout(id);
      window.removeEventListener("focus", refresh);
    };
  }, [orgId, persistence, getAuthToken]);

  const commit = useCallback(
    (next: AgencyBook) => {
      setBook(next);
      if (persistence === "supabase") {
        void putHostedBook(getAuthToken, next, updatedAtRef.current)
          .then((saved) => {
            updatedAtRef.current = saved.updatedAt;
            setBook(saved.book);
          })
          .catch((err) => {
            toast.error(err instanceof Error ? err.message : "Could not save the diary");
            void fetchHostedBook(getAuthToken).then((hosted) => {
              if (hosted) {
                updatedAtRef.current = hosted.updatedAt;
                setBook(hosted.book);
              }
            });
          });
        return;
      }
      saveAgencyBook(orgId, next);
    },
    [getAuthToken, orgId, persistence],
  );

  return { book, commit, ready };
}

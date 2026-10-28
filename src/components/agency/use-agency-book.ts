"use client";

import { useEffect, useState } from "react";
import { applyAgencyInbox, seedAgencyBook } from "@/lib/agency/book";
import { publishMissingPortals } from "@/lib/agency/publish-client";
import { loadAgencyBook, saveAgencyBook } from "@/lib/agency/store";
import type { AgencyBook, AgencyInbox } from "@/lib/agency/types";

export function useAgencyBook(orgId: string) {
  const [book, setBook] = useState<AgencyBook>(() => seedAgencyBook());

  useEffect(() => {
    let cancel = false;
    const refresh = () => {
      void (async () => {
        let next = loadAgencyBook(orgId);
        try {
          const res = await fetch("/api/agency");
          if (res.ok) {
            const json = (await res.json()) as Partial<AgencyInbox> & { available?: boolean };
            if (json.available === false) {
              if (!cancel) setBook(next);
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
          // The office inbox is optional; keep the local book as it is.
        }
        if (!cancel) setBook(next);
      })();
    };
    const id = window.setTimeout(refresh, 0);
    window.addEventListener("focus", refresh);
    return () => {
      cancel = true;
      window.clearTimeout(id);
      window.removeEventListener("focus", refresh);
    };
  }, [orgId]);

  function commit(next: AgencyBook) {
    saveAgencyBook(orgId, next);
    setBook(next);
  }

  return { book, commit };
}

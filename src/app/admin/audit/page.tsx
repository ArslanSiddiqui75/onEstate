"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAdminSession } from "@/lib/admin/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fadeUp, staggerContainer } from "@/lib/motion";
import type { PlatformAuditEvent } from "@/lib/admin/types";

const PAGE_SIZE = 10;

const ENTITY_TYPES: Array<PlatformAuditEvent["entityType"] | "all"> = [
  "all",
  "tenant",
  "subscription",
  "member",
  "admin",
];

export default function AdminAuditPage() {
  const { registry } = useAdminSession();
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] =
    useState<(typeof ENTITY_TYPES)[number]>("all");
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("all");
  const [page, setPage] = useState(1);

  const actions = useMemo(() => {
    const set = new Set(registry.audit.map((e) => e.action));
    return ["all", ...Array.from(set).sort()];
  }, [registry.audit]);

  const actors = useMemo(() => {
    const set = new Set(registry.audit.map((e) => e.actorEmail));
    return ["all", ...Array.from(set).sort()];
  }, [registry.audit]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...registry.audit]
      .filter((event) => {
        if (entityType !== "all" && event.entityType !== entityType) return false;
        if (action !== "all" && event.action !== action) return false;
        if (actor !== "all" && event.actorEmail !== actor) return false;
        if (!q) return true;
        return (
          event.summary.toLowerCase().includes(q) ||
          event.action.toLowerCase().includes(q) ||
          event.actorEmail.toLowerCase().includes(q) ||
          event.entityId.toLowerCase().includes(q) ||
          event.entityType.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [registry.audit, query, entityType, action, actor]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, entityType, action, actor]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length);

  function clearFilters() {
    setQuery("");
    setEntityType("all");
    setAction("all");
    setActor("all");
  }

  const hasFilters =
    query.trim() !== "" ||
    entityType !== "all" ||
    action !== "all" ||
    actor !== "all";

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search summary, action, actor, entity…"
            aria-label="Search audit log"
          />
          <Select
            value={entityType}
            onValueChange={(v) =>
              setEntityType(v as (typeof ENTITY_TYPES)[number])
            }
          >
            <SelectTrigger aria-label="Filter by entity type">
              <SelectValue placeholder="Entity type" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type === "all" ? "All entities" : type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger aria-label="Filter by action">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {actions.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "all" ? "All actions" : item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger aria-label="Filter by actor">
              <SelectValue placeholder="Actor" />
            </SelectTrigger>
            <SelectContent>
              {actors.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "all" ? "All actors" : item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            disabled={!hasFilters}
            onClick={clearFilters}
          >
            Clear
          </Button>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Showing {rangeStart}–{rangeEnd} of {filtered.length}
          {hasFilters ? " matching filters" : " events"}
        </p>
      </Card>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        {pageItems.map((event) => (
          <motion.div key={event.id} variants={fadeUp}>
            <Card hover>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{event.summary}</p>
                <Badge tone="accent" className="capitalize">
                  {event.entityType}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {event.actorEmail} ·{" "}
                <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs">
                  {event.action}
                </code>{" "}
                · entity {event.entityId}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {new Date(event.at).toLocaleString()}
              </p>
            </Card>
          </motion.div>
        ))}

        {filtered.length === 0 ? (
          <Card className="py-14 text-center">
            <p className="text-sm text-[var(--muted)]">
              {registry.audit.length === 0
                ? "No audit events yet. Tenant creation and admin actions will appear here."
                : "No events match these filters."}
            </p>
            {hasFilters ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-4"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            ) : null}
          </Card>
        ) : null}
      </motion.div>

      {filtered.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted)]">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

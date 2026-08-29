"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addSection,
  applySectionLayout,
  moveSection,
  removeSection,
  resolveSections,
  SECTION_CATALOG,
  sectionVariant,
  setSectionVariant,
  setSectionVisible,
  unusedOptionalKinds,
} from "@/lib/website/sections";
import { getTemplate } from "@/lib/website/templates";
import type { WebsiteSectionKind, WebsiteSite } from "@/types";

export function SectionPalette({
  site,
  canEdit,
  onChange,
}: {
  site: WebsiteSite;
  canEdit: boolean;
  onChange: (patch: Partial<WebsiteSite>) => void;
}) {
  const template = getTemplate(site.templateId);
  const sections = resolveSections(site);
  const unused = unusedOptionalKinds(sections);

  const commit = (next: typeof sections) => {
    onChange(applySectionLayout(next));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div className="space-y-2">
        {sections.map((section, index) => {
          const def = SECTION_CATALOG[section.kind];
          const variant = sectionVariant(section, template);
          return (
            <div
              key={section.kind}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={!canEdit || index === 0}
                  onClick={() => commit(moveSection(sections, section.kind, -1))}
                  className="rounded p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                  aria-label={`Move ${def.label} up`}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!canEdit || index === sections.length - 1}
                  onClick={() => commit(moveSection(sections, section.kind, 1))}
                  className="rounded p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                  aria-label={`Move ${def.label} down`}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="min-w-[7rem] flex-1">
                <p className="text-sm font-medium">{def.label}</p>
                <p className="text-[11px] text-[var(--muted)]">{def.description}</p>
              </div>
              <Select
                value={variant}
                disabled={!canEdit}
                onValueChange={(value) =>
                  commit(setSectionVariant(sections, section.kind, value))
                }
              >
                <SelectTrigger className="h-8 w-[10.5rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {def.variants.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Switch
                checked={section.visible}
                disabled={!canEdit}
                onCheckedChange={(val) =>
                  commit(setSectionVisible(sections, section.kind, val))
                }
              />
              {!def.core ? (
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => commit(removeSection(sections, section.kind))}
                  className="rounded p-1 text-[var(--muted)] hover:text-[var(--danger)] disabled:opacity-30"
                  aria-label={`Remove ${def.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--muted)]">Add a block</p>
        {unused.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">All curated blocks are on the page.</p>
        ) : (
          unused.map((kind) => {
            const def = SECTION_CATALOG[kind];
            return (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant="secondary"
                disabled={!canEdit}
                className="w-full justify-start"
                onClick={() => commit(addSection(sections, kind as WebsiteSectionKind))}
              >
                <Plus className="h-3.5 w-3.5" />
                {def.label}
              </Button>
            );
          })
        )}
        <p className="pt-1 text-[11px] leading-relaxed text-[var(--muted)]">
          Curated blocks only — not a freeform canvas. Footer stays at the bottom.
        </p>
      </div>
    </div>
  );
}

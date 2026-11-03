import { beforeEach, describe, expect, it } from "vitest";
import {
  loadStarredLeadIds,
  saveStarredLeadIds,
  toggleStarredLeadId,
} from "@/lib/crm/conversation-stars";

function installMemoryStorage() {
  const store = new Map<string, string>();
  const memory = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: memory },
  });
  return memory;
}

describe("conversation stars", () => {
  beforeEach(() => {
    installMemoryStorage().clear();
  });

  it("persists starred lead ids per workspace seat", () => {
    expect(loadStarredLeadIds("org-a", "user-1").size).toBe(0);
    saveStarredLeadIds("org-a", "user-1", new Set(["lead-1", "lead-2"]));
    expect([...loadStarredLeadIds("org-a", "user-1")].sort()).toEqual(["lead-1", "lead-2"]);
    expect(loadStarredLeadIds("org-a", "user-2").size).toBe(0);
  });

  it("toggles a single lead", () => {
    toggleStarredLeadId("org-a", "user-1", "lead-1", true);
    expect(loadStarredLeadIds("org-a", "user-1").has("lead-1")).toBe(true);
    toggleStarredLeadId("org-a", "user-1", "lead-1", false);
    expect(loadStarredLeadIds("org-a", "user-1").has("lead-1")).toBe(false);
  });
});

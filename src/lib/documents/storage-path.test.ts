import { describe, expect, it } from "vitest";
import { isOrgOwnedStoragePath } from "@/lib/documents/storage-path";

describe("isOrgOwnedStoragePath", () => {
  it("accepts a file inside the workspace folder", () => {
    expect(isOrgOwnedStoragePath("org_a", "org_a/file.pdf")).toBe(true);
  });

  it("rejects another workspace and path traversal", () => {
    expect(isOrgOwnedStoragePath("org_a", "org_b/file.pdf")).toBe(false);
    expect(isOrgOwnedStoragePath("org_a", "org_a/../org_b/file.pdf")).toBe(false);
    expect(isOrgOwnedStoragePath("org_a", "org_a")).toBe(false);
  });
});

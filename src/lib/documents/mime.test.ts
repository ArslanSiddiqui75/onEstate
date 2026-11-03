import { describe, expect, it } from "vitest";
import { resolveDocumentMime } from "@/lib/documents/mime";

describe("resolveDocumentMime", () => {
  it("maps extension when the client omits MIME", () => {
    expect(resolveDocumentMime({ ext: "pdf" })).toBe("application/pdf");
    expect(resolveDocumentMime({ ext: "png" })).toBe("image/png");
  });

  it("accepts a matching client claim", () => {
    expect(
      resolveDocumentMime({ ext: "jpg", claimed: "image/jpeg" }),
    ).toBe("image/jpeg");
  });

  it("rejects a spoofed claim that disagrees with the extension family", () => {
    expect(
      resolveDocumentMime({ ext: "pdf", claimed: "image/png" }),
    ).toBe("application/pdf");
  });

  it("returns null for unknown extensions", () => {
    expect(resolveDocumentMime({ ext: "exe" })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { isOptOutMessage } from "@/lib/messaging/opt-out";

describe("isOptOutMessage", () => {
  it("accepts carrier keywords in any case", () => {
    for (const word of ["STOP", "stop", " Stop. ", "UNSUBSCRIBE", "Quit", "END", "cancel"]) {
      expect(isOptOutMessage(word)).toBe(true);
    }
  });

  it("ignores ordinary replies", () => {
    for (const text of ["Please don't stop calling", "Can you cancel my viewing?", "yes", "", "stop texting me"]) {
      expect(isOptOutMessage(text)).toBe(false);
    }
  });
});

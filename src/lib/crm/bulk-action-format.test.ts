import { describe, expect, it } from "vitest";
import {
  formatCompactCount,
  importStatsFromRecord,
  percentOf,
  smsStatsFromRecord,
} from "@/lib/crm/bulk-action-format";
import type { BulkActionRecord } from "@/lib/crm/bulk-action-log";

describe("bulk action format helpers", () => {
  it("compacts large counts like the stats cards", () => {
    expect(formatCompactCount(303)).toBe("303");
    expect(formatCompactCount(4320)).toBe("4.3K");
    expect(percentOf(284, 292)).toBe(97.3);
  });

  it("summarises SMS and import records for the stats modals", () => {
    const sms: BulkActionRecord = {
      id: "1",
      at: "2026-11-04T00:00:00.000Z",
      type: "sms",
      label: "Bulk SMS",
      count: 3,
      smsItems: [
        {
          id: "a",
          identifier: "Ada",
          phone: "+1555",
          status: "sent",
          at: "2026-11-04T00:00:00.000Z",
        },
        {
          id: "b",
          identifier: "Bea",
          phone: "+1556",
          status: "skipped",
          at: "2026-11-04T00:00:00.000Z",
        },
        {
          id: "c",
          identifier: "Cyd",
          phone: "+1557",
          status: "error",
          at: "2026-11-04T00:00:00.000Z",
        },
      ],
    };
    const smsStats = smsStatsFromRecord(sms);
    expect(smsStats.all).toBe(3);
    expect(smsStats.sent).toBe(1);
    expect(smsStats.skipped).toBe(1);
    expect(smsStats.error).toBe(1);

    const imp: BulkActionRecord = {
      id: "2",
      at: "2026-11-04T00:00:00.000Z",
      type: "import",
      label: "Import",
      count: 2,
      importItems: [
        {
          id: "i1",
          line: 2,
          identifier: "a@x.com",
          object: "Contacts",
          type: "created",
        },
        {
          id: "i2",
          line: 3,
          identifier: "b@x.com",
          object: "Contacts",
          type: "warning",
        },
      ],
    };
    const importStats = importStatsFromRecord(imp);
    expect(importStats.success).toBe(1);
    expect(importStats.warning).toBe(1);
    expect(importStats.successPct).toBe(50);
  });
});

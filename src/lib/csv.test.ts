import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("neutralises formulas but keeps phone numbers and negatives", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("+447700900077")).toBe("+447700900077");
    expect(csvCell("-12.5")).toBe("-12.5");
    expect(csvCell("-cmd")).toBe("'-cmd");
  });

  it("quotes commas, quotes and hashes survive", () => {
    expect(toCsv([["Flat #4, High St", 'say "hi"']])).toBe('"Flat #4, High St","say ""hi"""');
  });

  it("parses quoted fields and CRLF line endings", () => {
    expect(parseCsv('name,email\r\n"Doe, Jane",jane@x.com\r\n\r\nBob,\r\n')).toEqual([
      ["name", "email"],
      ["Doe, Jane", "jane@x.com"],
      ["Bob", ""],
    ]);
  });

  it("round-trips an export", () => {
    const rows = [["Name", "Source"], ["O'Neil, Sam", "Flat #4"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

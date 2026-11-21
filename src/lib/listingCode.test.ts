import { describe, expect, it } from "vitest";
import { formatListingCode, listingCodeError, normalizeListingCode } from "./listingCode";

describe("listing IDs", () => {
  it("pads the number to the chosen digits and lets bigger numbers grow", () => {
    expect(formatListingCode("HKLS", 2, 1)).toBe("HKLS01");
    expect(formatListingCode("HKLS", 2, 99)).toBe("HKLS99");
    expect(formatListingCode("HKLS", 2, 100)).toBe("HKLS100");
    expect(formatListingCode("HK", 4, 7)).toBe("HK0007");
  });

  it("are tidied into capitals and checked", () => {
    expect(normalizeListingCode("  hkls07 ")).toBe("HKLS07");
    expect(listingCodeError("")).toBeUndefined();
    expect(listingCodeError("hkls07")).toBeUndefined();
    expect(listingCodeError("A")).toMatch(/2–20/);
    expect(listingCodeError("HKLS 07")).toMatch(/2–20/);
  });
});

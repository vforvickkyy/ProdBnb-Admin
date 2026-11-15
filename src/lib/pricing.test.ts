import { describe, expect, it } from "vitest";
import { previewCharges } from "./pricing";

describe("previewCharges", () => {
  it("is the identity with no fee or tax", () => {
    expect(previewCharges(10000, 0, 0)).toEqual({ fee: 0, tax: 0, total: 10000 });
  });

  it("taxes the fee too, matching the backend's worked example", () => {
    // base 100.00, fee 10% = 10.00, tax 18% of 110.00 = 19.80
    expect(previewCharges(10000, 1000, 1800)).toEqual({ fee: 1000, tax: 1980, total: 12980 });
  });
});

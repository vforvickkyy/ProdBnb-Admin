import { describe, expect, it } from "vitest";
import { detailsFromListing, detailsToBody, EMPTY_DETAILS, validateDetails } from "./DetailsForm";
import { emptyProp, propsFromListing, propsToBody, validateProps } from "./PropsEditor";
import { groupFeatures } from "./Features";

const base = {
  title: "Loft",
  description: "",
  capacity: 25,
  timezone: "Asia/Kolkata",
  instant_booking_enabled: false,
  address_line1: null,
  address_line2: null,
  city: "Mohali",
  region: null,
  country: "India",
  postal_code: null,
  latitude: null,
  longitude: null,
};

describe("space details", () => {
  it("turn the form into the API body, leaving unknowns as null", () => {
    const body = detailsToBody({ ...EMPTY_DETAILS, title: "Loft", city: "Mohali", area_sqft: "1800", parking_spaces: "0", electricity: "included", permission_needed: "no" });
    expect(body).toMatchObject({
      area_sqft: 1800,
      set_count: null,
      parking_spaces: 0,
      restroom_count: null,
      electricity: "included",
      permission_needed: false,
      permission_details: null,
    });
  });

  it("keep the permission note only when permission is needed", () => {
    const yes = detailsToBody({ ...EMPTY_DETAILS, permission_needed: "yes", permission_details: "  Society NOC  " });
    expect(yes.permission_needed).toBe(true);
    expect(yes.permission_details).toBe("Society NOC");
    const no = detailsToBody({ ...EMPTY_DETAILS, permission_needed: "no", permission_details: "left over" });
    expect(no.permission_details).toBeNull();
  });

  it("read back from a listing, including a listing that has none of them", () => {
    expect(detailsFromListing({ ...base, area_sqft: 900, permission_needed: true, permission_details: "NOC", electricity: "extra" })).toMatchObject({
      area_sqft: "900",
      permission_needed: "yes",
      permission_details: "NOC",
      electricity: "extra",
      listing_code: "",
    });
    expect(detailsFromListing(base)).toMatchObject({ area_sqft: "", permission_needed: "", electricity: "" });
  });

  it("check the numbers and the listing ID", () => {
    const errors = validateDetails({ ...EMPTY_DETAILS, title: "x", city: "c", country: "c", area_sqft: "0", set_count: "201", parking_spaces: "-1", listing_code: "A" });
    expect(Object.keys(errors).sort()).toEqual(["area_sqft", "listing_code", "parking_spaces", "set_count"].sort());
    expect(validateDetails({ ...EMPTY_DETAILS, title: "x", city: "c", country: "c", parking_spaces: "0" })).toEqual({});
  });

  it("send the listing ID only when one was typed, in capitals", () => {
    expect("listing_code" in detailsToBody(EMPTY_DETAILS)).toBe(false);
    expect(detailsToBody({ ...EMPTY_DETAILS, listing_code: "hkls09" }).listing_code).toBe("HKLS09");
  });
});

describe("props", () => {
  it("store the price in paise and only for add-ons", () => {
    const rows = [
      { ...emptyProp("included"), name: "Sofa set", price: "999" },
      { ...emptyProp("addon"), name: "Fog machine", price: "1500", unit: "per_hour" as const },
      { ...emptyProp("addon"), name: "Vintage car", note: " ask us " },
      { ...emptyProp("included"), name: "   " },
    ];
    expect(propsToBody(rows)).toEqual([
      { name: "Sofa set", kind: "included", price_minor_units: null, price_unit: null, note: null },
      { name: "Fog machine", kind: "addon", price_minor_units: 150000, price_unit: "per_hour", note: null },
      { name: "Vintage car", kind: "addon", price_minor_units: null, price_unit: null, note: "ask us" },
    ]);
  });

  it("round-trip through the form", () => {
    const rows = propsFromListing([{ name: "Lights", kind: "addon", price_minor_units: 250050, price_unit: "per_day", note: null }]);
    expect(rows[0]).toMatchObject({ name: "Lights", price: "2500.50", unit: "per_day" });
    expect(propsToBody(rows)[0]?.price_minor_units).toBe(250050);
  });

  it("refuse repeated names and bad prices", () => {
    expect(validateProps([{ ...emptyProp(), name: "Sofa" }, { ...emptyProp("addon"), name: "sofa" }])).toMatch(/twice/);
    expect(validateProps([{ ...emptyProp("addon"), name: "Fog", price: "1.2.3" }])).toMatch(/price/);
    expect(validateProps([{ ...emptyProp(), name: "Sofa" }])).toBeUndefined();
  });
});

describe("feature groups", () => {
  it("split amenities from rules and keep the catalog order under each heading", () => {
    const groups = groupFeatures(
      [
        { id: "1", name: "Wi-Fi", kind: "amenity", group_name: "Power and internet", position: 20 },
        { id: "2", name: "Restroom", kind: "amenity", group_name: "Rooms and facilities", position: 10 },
        { id: "3", name: "Power backup", kind: "amenity", group_name: "Power and internet", position: 21 },
        { id: "4", name: "Smoking allowed", kind: "rule", group_name: "Allowed here", position: 5 },
      ],
      "amenity",
    );
    expect(groups.map((g) => g.heading)).toEqual(["Rooms and facilities", "Power and internet"]);
    expect(groups[1]?.items.map((i) => i.name)).toEqual(["Wi-Fi", "Power backup"]);
    expect(groupFeatures([{ id: "4", name: "Smoking allowed", kind: "rule", position: 5 }], "rule")[0]?.heading).toBe("Other");
  });
});

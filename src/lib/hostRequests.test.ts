import { describe, expect, it } from "vitest";
import { nextSteps, telHref } from "./hostRequests";
import { navCountLabel } from "./useNavCounts";
import { NAV_SECTIONS } from "./nav";

describe("host requests", () => {
  it("move new -> contacted -> done, can be closed, reopened, and a withdrawn one has no buttons", () => {
    expect(nextSteps("new").map((s) => s.status)).toEqual(["contacted", "closed"]);
    expect(nextSteps("contacted").map((s) => s.status)).toEqual(["done", "closed"]);
    expect(nextSteps("done")).toEqual([{ status: "contacted", label: "Reopen" }]);
    expect(nextSteps("closed")[0].label).toBe("Reopen");
    expect(nextSteps("withdrawn")).toEqual([]);
  });

  it("dial the number without spaces or dashes", () => {
    expect(telHref("+91 98765-43210")).toBe("tel:+919876543210");
    expect(telHref("(022) 2345 6789")).toBe("tel:02223456789");
  });

  it("show a count in the sidebar, capped, and nothing for zero", () => {
    expect(navCountLabel(3)).toBe("3");
    expect(navCountLabel(150)).toBe("99+");
    expect(navCountLabel(0)).toBeNull();
    expect(navCountLabel(undefined)).toBeNull();
  });

  it("are in the People menu, only for admins who can handle them", () => {
    const item = NAV_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.items)).find((i) => i.href === "/hosts/requests");
    expect(item).toMatchObject({ label: "Host requests", permission: "host_requests.manage", count: "hostRequests" });
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonOk, me } from "@/test/apiMock";
import NewCouponPage from "./page";

const { getMock, postMock, push } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: postMock } };
});
vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

describe("New coupon", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a ProdBnb percentage coupon with a cap, limits and dates", async () => {
    getMock.mockImplementation(() => jsonOk(me("finance", ["payments.view", "coupons.manage"])));
    postMock.mockImplementation(() => jsonOk({ id: "c1", code: "MONSOON20" }));
    const user = userEvent.setup();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <NewCouponPage />
      </SWRConfig>,
    );
    const create = screen.getByRole("button", { name: "Create coupon" });
    expect(create).toBeDisabled();
    await user.type(screen.getByLabelText("Code"), "monsoon20");
    await user.type(screen.getByLabelText("Title"), "Monsoon 20% off");
    await user.type(screen.getByLabelText("Percent off"), "20");
    await user.type(screen.getByLabelText("Up to ₹ (optional cap)"), "1000");
    await user.type(screen.getByLabelText("Total uses (optional)"), "100");
    await user.type(screen.getByLabelText("Ends (optional)"), "2026-12-31");
    await user.click(screen.getByRole("switch", { name: /^Show publicly/ }));
    await user.click(create);
    expect(postMock).toHaveBeenCalledWith("/coupons", {
      body: expect.objectContaining({
        owner_type: "platform",
        host_id: null,
        code: "MONSOON20",
        discount_type: "percent",
        percent_off: 20,
        max_discount_minor_units: 100_000,
        usage_limit: 100,
        per_user_limit: 1,
        is_public: true,
        ends_at: "2026-12-31T23:59:59+05:30",
        location_ids: [],
      }),
    });
    expect(push).toHaveBeenCalledWith("/payments/coupons/c1");
  });
});

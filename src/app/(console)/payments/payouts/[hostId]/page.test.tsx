import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonOk, me } from "@/test/apiMock";
import HostPayoutPage from "./page";

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));
// React 18.3 has no `use`; Next bundles its own React. Same polyfill as users/[id]/page.test.tsx.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  function usePolyfill<T>(promise: Promise<T> & { status?: string; value?: T; reason?: unknown }): T {
    if (promise.status === "fulfilled") return promise.value as T;
    if (promise.status === "rejected") throw promise.reason;
    if (promise.status === undefined) {
      promise.status = "pending";
      promise.then(
        (v) => {
          promise.status = "fulfilled";
          promise.value = v;
        },
        (e) => {
          promise.status = "rejected";
          promise.reason = e;
        },
      );
    }
    throw promise;
  }
  return { ...actual, use: usePolyfill };
});
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: postMock } };
});

const row = (id: string, title: string, state: string, net: number) => ({
  booking_id: id,
  status: "completed",
  start_at: "2026-11-10T09:00:00Z",
  end_at: "2026-11-10T12:00:00Z",
  location: { id: `l-${id}`, title },
  currency: "INR",
  paid_minor_units: net * 1.3,
  refunded_minor_units: 0,
  base_minor_units: net,
  net_minor_units: net,
  state,
  payout: null,
});

const earnings = {
  host: { id: "h1", first_name: "Rohan", last_name: "Mehta" },
  account: { account_holder_name: "Rohan Mehta", account_last4: "4321", ifsc: "HDFC0001234", bank_name: "HDFC Bank", pan_last4: "1234F", updated_at: "2026-11-01T00:00:00Z" },
  summary: { currency: "INR", ready_minor_units: 500000, on_hold_minor_units: 0, upcoming_minor_units: 200000, paid_minor_units: 0 },
  rows: [row("b1", "Sunset rooftop", "ready", 300000), row("b2", "Old mill", "ready", 200000), row("b3", "Beach shack", "upcoming", 200000)],
};

async function renderPage(permissions: string[]) {
  getMock.mockImplementation((path: string) => (path === "/me" ? jsonOk(me("finance", permissions)) : jsonOk(earnings)));
  await act(async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Suspense fallback={null}>
          <HostPayoutPage params={Promise.resolve({ hostId: "h1" })} />
        </Suspense>
      </SWRConfig>,
    );
  });
}

describe("Host payout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records a payout for the ticked bookings with the bank reference", async () => {
    postMock.mockImplementation(() => jsonOk({ id: "po1", amount_minor_units: 300000, currency: "INR" }));
    const user = userEvent.setup();
    await renderPage(["payments.view", "payments.refund"]);
    expect(await screen.findByText("Sunset rooftop")).toBeInTheDocument();
    expect(screen.getByText("Beach shack")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Old mill/ }));
    await user.type(screen.getByLabelText("Bank reference (UTR)"), "UTR123");
    await user.click(screen.getByRole("button", { name: /Record ₹3,000(\.00)? payout/ }));
    expect(postMock).toHaveBeenCalledWith("/hosts/{id}/payouts", {
      params: { path: { id: "h1" } },
      body: expect.objectContaining({ booking_ids: ["b1"], reference: "UTR123" }),
    });
  });

  it("shows the full bank details only on request", async () => {
    postMock.mockImplementation(() => jsonOk({ ...earnings.account, account_number: "50100012344321", pan: "ABCDE1234F" }));
    const user = userEvent.setup();
    await renderPage(["payments.view", "payments.refund"]);
    expect(await screen.findByText("···4321")).toBeInTheDocument();
    expect(screen.queryByText("50100012344321")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Show full details/ }));
    expect(await screen.findByText("50100012344321")).toBeInTheDocument();
    expect(postMock).toHaveBeenCalledWith("/hosts/{id}/payout-account/reveal", { params: { path: { id: "h1" } }, body: {} });
  });

  it("is read-only without payments.refund", async () => {
    await renderPage(["payments.view"]);
    expect(await screen.findByText("Sunset rooftop")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show full details/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Bank reference (UTR)")).not.toBeInTheDocument();
  });
});

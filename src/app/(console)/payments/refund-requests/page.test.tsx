import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonOk, jsonOkPaginated, me } from "@/test/apiMock";
import RefundRequestsPage from "./page";

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: postMock } };
});
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const request = {
  id: "rr1",
  booking_id: "b1",
  payment_id: "p1",
  source: "cancellation",
  reason: "Shoot postponed",
  status: "pending",
  approved_amount_minor_units: null,
  refund_id: null,
  decided_at: null,
  decision_note: null,
  created_at: "2026-11-16T10:00:00Z",
  updated_at: "2026-11-16T10:00:00Z",
  booking: {
    id: "b1",
    status: "cancelled",
    start_at: "2026-11-23T09:00:00Z",
    end_at: "2026-11-23T10:00:00Z",
    cancellation_reason: "Shoot postponed",
    location: { id: "l1", title: "Sunset rooftop", city: "Mumbai" },
    booker: { id: "u1", first_name: "Aanya", last_name: "Kapoor" },
  },
  payment: { id: "p1", amount_minor_units: 400000, currency: "INR", status: "success", method: "upi" },
  refunded_minor_units: 0,
  remaining_minor_units: 400000,
};

function renderPage(permissions: string[]) {
  getMock.mockImplementation((path: string) => (path === "/me" ? jsonOk(me("finance", permissions)) : jsonOkPaginated([request])));
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <RefundRequestsPage />
    </SWRConfig>,
  );
}

describe("Refund requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows what was paid, how, and why the booker wants money back", async () => {
    renderPage(["payments.view", "payments.refund"]);
    expect(await screen.findByText("Sunset rooftop")).toBeInTheDocument();
    expect(screen.getByText("Booking cancelled")).toBeInTheDocument();
    expect(screen.getByText("“Shoot postponed”")).toBeInTheDocument();
    expect(screen.getByText(/UPI/)).toBeInTheDocument();
  });

  it("approves part of the payment", async () => {
    postMock.mockImplementation(() => jsonOk({ ...request, status: "approved" }));
    const user = userEvent.setup();
    renderPage(["payments.view", "payments.refund"]);
    await user.click(await screen.findByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("radio", { name: "Part" }));
    const amount = screen.getByLabelText("Amount (₹)");
    await user.clear(amount);
    await user.type(amount, "2000");
    await user.type(screen.getByLabelText("Note to the booker (optional)"), "50% under policy");
    await user.click(screen.getByRole("button", { name: /Refund ₹2,000/ }));
    expect(postMock).toHaveBeenCalledWith("/refund-requests/{id}/approve", {
      params: { path: { id: "rr1" } },
      body: { amount_minor_units: 200000, note: "50% under policy" },
    });
  });

  it("needs a note to decline, and hides decisions from roles without payments.refund", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage(["payments.view", "payments.refund"]);
    await user.click(await screen.findByRole("button", { name: "Decline" }));
    expect(screen.getByRole("button", { name: "Decline request" })).toBeDisabled();
    unmount();
    renderPage(["payments.view"]);
    expect(await screen.findByText("Sunset rooftop")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});

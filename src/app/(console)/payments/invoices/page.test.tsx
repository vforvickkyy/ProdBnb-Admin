import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonOk, me } from "@/test/apiMock";
import InvoicesPage from "./page";

const { getMock, postMock, replace, params } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), replace: vi.fn(), params: { value: "" } }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: postMock } };
});
vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(params.value) }));

const invoice = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  number: "INV/26-27/0007",
  fy: "26-27",
  booking_id: "b1",
  payment_id: "p1",
  user_id: "u1",
  issued_at: "2026-11-17T10:00:00Z",
  seller: { name: "Co", address: [] },
  billed_to: { name: "Riya Menon", email: "riya@example.com", address: [] },
  details: { booking_ref: "B1", listing: "Sunlit loft", city: "Mumbai", booking_type: "Hourly", when: "21 Nov 2026, 10:00–14:00", payment_ref: null, payment_method: "UPI", paid_at: null },
  currency: "INR",
  subtotal_minor_units: 600000,
  discount_minor_units: 0,
  coupon_code: null,
  service_fee_minor_units: 0,
  tax_minor_units: 0,
  tax_rate_bps: null,
  total_minor_units: 600000,
  tax_label: "GST",
  sac_code: null,
  delivery_status: "pending",
  sent_via: null,
  sent_at: null,
  sent_to: null,
  send_count: 0,
  last_error: null,
  ...over,
});

function setup(opts: { permissions: string[]; settings?: Record<string, unknown> }) {
  getMock.mockImplementation((path: string) => {
    if (path === "/me") return jsonOk(me("finance", opts.permissions));
    if (path === "/invoice-settings") return jsonOk({ missing: [], email_connected: true, ...opts.settings });
    if (path === "/invoices")
      return Promise.resolve({
        data: { data: [invoice()], meta: { page: 1, pageSize: 25, total: 1, counts: { all: 9, pending: 1, sent_auto: 6, sent_manual: 1, failed: 1, waiting: 3 } } },
        error: undefined,
        response: { status: 200 },
      });
    return jsonOk(null);
  });
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <InvoicesPage />
    </SWRConfig>,
  );
}

describe("Invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params.value = "";
  });

  it("shows the email-status tabs with counts and sends a pending invoice", async () => {
    postMock.mockImplementation(() => jsonOk(invoice({ delivery_status: "sent", sent_via: "manual", sent_to: "accounts@lantern.example" })));
    setup({ permissions: ["payments.view", "invoices.manage"] });
    const user = userEvent.setup();
    const tabs = await screen.findByRole("tablist", { name: "Invoices by email status" });
    expect(within(tabs).getByRole("tab", { name: /Pending to send/ })).toHaveTextContent("1");
    expect(within(tabs).getByRole("tab", { name: /Sent automatically/ })).toHaveTextContent("6");
    expect(within(tabs).getByRole("tab", { name: /Failed/ })).toHaveTextContent("1");
    await user.click(within(tabs).getByRole("tab", { name: /Sent manually/ }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("filter=sent_manual"), { scroll: false });

    expect(await screen.findByText("3 paid bookings have no invoice yet (paid before the template was filled in).")).toBeInTheDocument();
    expect(screen.getByText("Pending to send", { selector: "span" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send" }));
    const to = screen.getByLabelText("Send to");
    expect(to).toHaveValue("riya@example.com");
    await user.clear(to);
    await user.type(to, "accounts@lantern.example");
    await user.click(screen.getByRole("button", { name: "Send email" }));
    expect(postMock).toHaveBeenCalledWith("/invoices/{id}/send", { params: { path: { id: "i1" } }, body: { to: "accounts@lantern.example" } });
  });

  it("is read-only without invoices.manage, and points to the template when it's incomplete", async () => {
    setup({ permissions: ["payments.view"], settings: { missing: ["legal name", "address"], email_connected: false } });
    expect(await screen.findByText(/can't be issued until the template has the company's legal name and address/)).toBeInTheDocument();
    expect(screen.getByText(/Email isn't connected/)).toBeInTheDocument();
    expect(await screen.findByText("INV/26-27/0007")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send all pending/ })).not.toBeInTheDocument();
  });
});

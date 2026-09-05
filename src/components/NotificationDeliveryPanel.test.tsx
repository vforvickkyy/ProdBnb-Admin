import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotificationDeliveryPanel } from "./NotificationDeliveryPanel";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: vi.fn() } };
});

function jsonOkPaginated(rows: unknown[], total = rows.length) {
  return Promise.resolve({ data: { data: rows, meta: { page: 1, pageSize: 5, total } }, error: undefined, response: { status: 200 } });
}

// SWR's default cache is a module-level singleton; a fresh provider per
// render keeps one test's response from leaking into the next.
function renderPanel(bookingId = "b1") {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <NotificationDeliveryPanel bookingId={bookingId} />
    </SWRConfig>
  );
}

describe("NotificationDeliveryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading skeleton before the fetch resolves", async () => {
    let resolveFetch!: (v: unknown) => void;
    getMock.mockImplementation(() => new Promise((resolve) => (resolveFetch = resolve)));

    renderPanel();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

    resolveFetch(await jsonOkPaginated([]));
    expect(await screen.findByText("No delivery attempts recorded yet")).toBeInTheDocument();
  });

  it("shows the empty state, not an error, when there are no delivery attempts", async () => {
    getMock.mockImplementation(() => jsonOkPaginated([]));
    renderPanel();
    expect(await screen.findByText("No delivery attempts recorded yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error state on API failure", async () => {
    getMock.mockImplementation(() => Promise.resolve({ data: undefined, error: { error: { message: "Boom." } }, response: { status: 500 } }));
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom.");
  });

  it("renders sent/failed/invalid_token/skipped with the correct tones, and treats skipped as informational, not an error", async () => {
    getMock.mockImplementation(() =>
      jsonOkPaginated([
        { id: "a1", notification_id: "n1", device_id: "d1", provider: "apns", status: "sent", provider_message_id: "m1", error_reason: null, created_at: "2026-01-01T00:00:00Z", device: { platform: "ios", environment: "sandbox", is_active: true } },
        { id: "a2", notification_id: "n1", device_id: "d2", provider: "apns", status: "failed", provider_message_id: null, error_reason: "APNs rejected the token", created_at: "2026-01-01T00:01:00Z", device: { platform: "ios", environment: "sandbox", is_active: true } },
        { id: "a3", notification_id: "n1", device_id: "d3", provider: "apns", status: "invalid_token", provider_message_id: null, error_reason: "BadDeviceToken", created_at: "2026-01-01T00:02:00Z", device: { platform: "ios", environment: "sandbox", is_active: false } },
        { id: "a4", notification_id: "n1", device_id: "d4", provider: "disabled", status: "skipped", provider_message_id: null, error_reason: null, created_at: "2026-01-01T00:03:00Z", device: { platform: "android", environment: null, is_active: true } },
      ])
    );

    renderPanel();

    expect(await screen.findByText("sent")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("invalid token")).toBeInTheDocument();
    expect(screen.getByText("skipped")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    expect(screen.getByText("APNs rejected the token")).toBeInTheDocument();
    expect(screen.getByText("BadDeviceToken")).toBeInTheDocument();
    // null error_reason renders as a clean em dash, not "null"/blank
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders device platform, environment, and active/inactive state", async () => {
    getMock.mockImplementation(() =>
      jsonOkPaginated([
        { id: "a1", notification_id: "n1", device_id: "d1", provider: "apns", status: "sent", provider_message_id: "m1", error_reason: null, created_at: "2026-01-01T00:00:00Z", device: { platform: "ios", environment: "production", is_active: true } },
        { id: "a2", notification_id: "n1", device_id: "d2", provider: "apns", status: "invalid_token", provider_message_id: null, error_reason: "BadDeviceToken", created_at: "2026-01-01T00:01:00Z", device: { platform: "android", environment: null, is_active: false } },
      ])
    );

    renderPanel();

    expect(await screen.findByText("ios")).toBeInTheDocument();
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("android")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("supports pagination", async () => {
    getMock.mockImplementation(() =>
      jsonOkPaginated(
        [{ id: "a1", notification_id: "n1", device_id: "d1", provider: "apns", status: "sent", provider_message_id: "m1", error_reason: null, created_at: "2026-01-01T00:00:00Z", device: { platform: "ios", environment: "sandbox", is_active: true } }],
        12
      )
    );

    renderPanel();

    expect(await screen.findByText("Showing 1–5 of 12")).toBeInTheDocument();
  });

  it("requests the given bookingId as a query parameter", async () => {
    getMock.mockImplementation(() => jsonOkPaginated([]));
    renderPanel("b-specific");
    await screen.findByText("No delivery attempts recorded yet");
    expect(getMock).toHaveBeenCalledWith(
      "/notifications/delivery-attempts",
      expect.objectContaining({ params: { query: expect.objectContaining({ booking_id: "b-specific" }) } })
    );
  });
});

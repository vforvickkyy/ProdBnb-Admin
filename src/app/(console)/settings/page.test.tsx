import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonOk, me } from "@/test/apiMock";
import SettingsPage from "./page";

const { getMock, patchMock } = vi.hoisted(() => ({ getMock: vi.fn(), patchMock: vi.fn() }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, PATCH: patchMock } };
});

const settings = {
  id: "s1",
  platform_fee_bps: 500,
  tax_bps: 1800,
  unpaid_hold_minutes: null,
  availability_requires_login: true,
  listing_id_prefix: "HKLS",
  listing_id_digits: 2,
  listing_id_next: 18,
  updated_by: null,
  updated_at: "2026-11-15T10:00:00Z",
};

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <SettingsPage />
    </SWRConfig>
  );
}

describe("General settings page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no longer edits fees or tax -- it points to Charges & taxes instead", async () => {
    getMock.mockImplementation((path: string) => (path === "/me" ? jsonOk(me("super_admin", ["settings.view", "settings.manage"])) : jsonOk(settings)));
    renderPage();
    expect(await screen.findByRole("button", { name: "Save booking rules" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Platform fee (%)")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Charges & taxes/ })).toHaveAttribute("href", "/charges");
  });

  it("turns on unpaid-hold expiry and saves only that field", async () => {
    getMock.mockImplementation((path: string) => (path === "/me" ? jsonOk(me("super_admin", ["settings.view", "settings.manage"])) : jsonOk(settings)));
    patchMock.mockImplementation(() => jsonOk({ ...settings, unpaid_hold_minutes: 45 }));
    const user = userEvent.setup();
    renderPage();

    const save = await screen.findByRole("button", { name: "Save booking rules" });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("switch", { name: /Cancel unpaid bookings automatically/ }));
    const minutes = screen.getByLabelText("Minutes a booking may stay unpaid");
    await user.clear(minutes);
    await user.type(minutes, "45");
    await user.click(save);

    expect(patchMock).toHaveBeenCalledWith("/settings", { body: { unpaid_hold_minutes: 45 } });
  });

  it("is read-only for an admin without settings.manage", async () => {
    getMock.mockImplementation((path: string) => (path === "/me" ? jsonOk(me("moderator", ["settings.view"])) : jsonOk(settings)));
    renderPage();
    expect(await screen.findByText("Only a super admin can change platform settings.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /Cancel unpaid bookings automatically/ })).toBeDisabled();
  });

  it("turns the login-to-see-availability rule off and saves only that field", async () => {
    getMock.mockImplementation((path: string) => (path === "/me" ? jsonOk(me("super_admin", ["settings.view", "settings.manage"])) : jsonOk(settings)));
    patchMock.mockImplementation(() => jsonOk({ ...settings, availability_requires_login: false }));
    const user = userEvent.setup();
    renderPage();

    const toggle = await screen.findByRole("switch", { name: /Require login to check availability/ });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Save booking rules" }));
    expect(patchMock).toHaveBeenCalledWith("/settings", { body: { availability_requires_login: false } });
  });

  it("shows the next listing ID and saves only the listing ID fields that changed", async () => {
    getMock.mockImplementation((path: string) => (path === "/me" ? jsonOk(me("super_admin", ["settings.view", "settings.manage"])) : jsonOk(settings)));
    patchMock.mockImplementation(() => jsonOk({ ...settings, listing_id_prefix: "HK", listing_id_next: 100 }));
    const user = userEvent.setup();
    renderPage();

    const save = await screen.findByRole("button", { name: "Save listing IDs" });
    expect(await screen.findByText("HKLS18")).toBeInTheDocument();
    expect(save).toBeDisabled();

    const prefix = screen.getByLabelText("Prefix");
    await user.clear(prefix);
    await user.type(prefix, "hk");
    const next = screen.getByLabelText("Next number");
    await user.clear(next);
    await user.type(next, "100");
    expect(screen.getByText("HK100")).toBeInTheDocument();
    await user.click(save);

    expect(patchMock).toHaveBeenCalledWith("/settings", { body: { listing_id_prefix: "HK", listing_id_next: 100 } });
  });

  it("will not save a prefix with spaces or digits outside 1 to 8", async () => {
    getMock.mockImplementation((path: string) => (path === "/me" ? jsonOk(me("super_admin", ["settings.view", "settings.manage"])) : jsonOk(settings)));
    const user = userEvent.setup();
    renderPage();

    const save = await screen.findByRole("button", { name: "Save listing IDs" });
    const digits = screen.getByLabelText("Digits");
    await user.clear(digits);
    await user.type(digits, "9");
    expect(screen.getByText("A whole number from 1 to 8.")).toBeInTheDocument();
    expect(save).toBeDisabled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonOk, me } from "@/test/apiMock";
import SettingsPage from "./page";

const { getMock, patchMock } = vi.hoisted(() => ({ getMock: vi.fn(), patchMock: vi.fn() }));

vi.mock("@/components/AdminShell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, PATCH: patchMock } };
});

const settings = { id: "s1", platform_fee_bps: 0, tax_bps: 0, unpaid_hold_minutes: null, updated_by: null, updated_at: "2026-11-15T10:00:00Z" };

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <SettingsPage />
    </SWRConfig>
  );
}

describe("Settings page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is read-only for an admin without settings.manage", async () => {
    getMock.mockImplementation((path: string) => (path === "/me" ? jsonOk(me("moderator", ["settings.view"])) : jsonOk(settings)));
    renderPage();
    expect(await screen.findByText("Only a super admin can change platform settings.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save settings" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Platform fee (%)")).toBeDisabled();
  });

  it("previews the price and saves only the fields that changed, with the reason", async () => {
    getMock.mockImplementation((path: string) => (path === "/me" ? jsonOk(me("super_admin", ["settings.view", "settings.manage"])) : jsonOk(settings)));
    patchMock.mockImplementation(() => jsonOk({ ...settings, platform_fee_bps: 1000 }));
    const user = userEvent.setup();
    renderPage();

    const save = await screen.findByRole("button", { name: "Save settings" });
    expect(save).toBeDisabled();

    const fee = screen.getByLabelText("Platform fee (%)");
    await user.clear(fee);
    await user.type(fee, "10");
    expect(screen.getByText("₹1,000.00")).toBeInTheDocument(); // 10% of the ₹10,000 preview
    await user.type(screen.getByLabelText("Reason (recorded in the audit log)"), "Launch pricing");
    await user.click(save);

    expect(patchMock).toHaveBeenCalledWith("/settings", { body: { platform_fee_bps: 1000, reason: "Launch pricing" } });
  });
});

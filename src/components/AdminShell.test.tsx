import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminShell } from "./AdminShell";

const { useAdminGateMock, signOutMock, clearSessionHintMock, replaceMock, mutateMock } = vi.hoisted(() => ({
  useAdminGateMock: vi.fn(),
  signOutMock: vi.fn().mockResolvedValue(undefined),
  clearSessionHintMock: vi.fn(),
  replaceMock: vi.fn(),
  mutateMock: vi.fn(),
}));

vi.mock("@/lib/useAdminGate", () => ({ useAdminGate: useAdminGateMock }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { signOut: signOutMock } } }));
vi.mock("@/lib/sessionHint", () => ({ clearSessionHint: clearSessionHintMock }));
// The only real SWR consumer in this tree is useAdminGate, already mocked
// above -- so mocking the whole `swr` module is safe here and lets this
// test verify the logout flow calls the documented global-cache-clear
// pattern without asserting anything about SWR's own internals (Phase 14-B5).
vi.mock("swr", () => ({ mutate: mutateMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/dashboard",
}));

describe("AdminShell", () => {
  it("renders a skip link as the first focusable element, targeting #main-content", () => {
    useAdminGateMock.mockReturnValue("admin");
    render(
      <AdminShell>
        <p>Page content</p>
      </AdminShell>
    );

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    expect(skipLink).toHaveAttribute("href", "#main-content");

    const focusable = screen.getAllByRole("link").concat(screen.getAllByRole("button"));
    expect(focusable[0]).toBe(skipLink);
  });

  it("gives <main> the id the skip link targets", () => {
    useAdminGateMock.mockReturnValue("admin");
    render(
      <AdminShell>
        <p>Page content</p>
      </AdminShell>
    );
    expect(document.getElementById("main-content")).toBeInTheDocument();
    expect(screen.getByText("Page content").closest("main")).toHaveAttribute("id", "main-content");
  });

  it("includes the mobile menu trigger alongside the desktop sidebar", () => {
    useAdminGateMock.mockReturnValue("admin");
    render(
      <AdminShell>
        <p>Page content</p>
      </AdminShell>
    );
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();
  });

  it("does not render the shell or skip link while the session is still checking", () => {
    useAdminGateMock.mockReturnValue("checking");
    render(
      <AdminShell>
        <p>Page content</p>
      </AdminShell>
    );
    expect(screen.queryByRole("link", { name: "Skip to main content" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking session…");
  });

  it("clears the SWR cache and completes Supabase sign-out before redirecting to /login", async () => {
    useAdminGateMock.mockReturnValue("admin");
    const user = userEvent.setup();
    render(
      <AdminShell>
        <p>Page content</p>
      </AdminShell>
    );

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
      expect(clearSessionHintMock).toHaveBeenCalled();
      expect(mutateMock).toHaveBeenCalledWith(expect.any(Function), undefined, { revalidate: false });
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });
  });
});

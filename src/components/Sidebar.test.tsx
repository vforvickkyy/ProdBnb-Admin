import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findActive } from "@/lib/nav";
import { setSidebarMode } from "@/lib/sidebarMode";
import { Sidebar } from "./Sidebar";

const { usePathnameMock, searchMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn(), searchMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useSearchParams: () => new URLSearchParams(searchMock() ?? ""),
}));

function at(path: string, search = "") {
  usePathnameMock.mockReturnValue(path);
  searchMock.mockReturnValue(search);
}

describe("Sidebar (Console 3: section rail + section menu)", () => {
  beforeEach(() => at("/dashboard"));

  it("shows one rail entry per section, so the sidebar never needs to scroll", () => {
    render(<Sidebar />);
    const rail = screen.getByRole("navigation", { name: "Admin sections" });
    for (const name of ["Overview", "Listings", "Bookings", "Payments", "People", "Messaging", "Platforms", "Settings"]) {
      expect(rail.querySelector(`a[href]`)).toBeTruthy();
      expect(screen.getAllByRole("link", { name }).length).toBeGreaterThan(0);
    }
  });

  it("opens the selected section's grouped menu and marks the current page", () => {
    at("/messaging/email");
    render(<Sidebar />);
    const menu = screen.getByRole("navigation", { name: "Messaging menu" });
    expect(menu).toHaveTextContent("Setup");
    expect(screen.getByRole("link", { name: "Email setup" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Sent messages" })).not.toHaveAttribute("aria-current");
  });

  it("lights up only the most specific item, including query-addressed tabs", () => {
    at("/platforms", "tab=flags");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Feature flags" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Status & incidents" })).not.toHaveAttribute("aria-current");
  });

  it("keeps detail pages under their list (a booking belongs to All bookings)", () => {
    expect(findActive("/bookings/8f1d2c3b")?.item.href).toBe("/bookings");
    expect(findActive("/locations/new")?.item.href).toBe("/locations/new");
    expect(findActive("/locations/abc/edit")?.item.href).toBe("/locations");
    expect(findActive("/charges")?.section.id).toBe("money");
  });

  it("hides sections and pages the admin's team role cannot use", () => {
    at("/payments");
    render(<Sidebar permissions={["dashboard.view", "users.view", "bookings.view"]} />);
    expect(screen.queryByRole("link", { name: "Payments" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "People" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Platforms" })).not.toBeInTheDocument();
  });

  it("puts Charges & taxes with payments, not in Settings", () => {
    at("/settings");
    render(<Sidebar />);
    const settings = screen.getByRole("navigation", { name: "Settings menu" });
    expect(settings).not.toHaveTextContent("Charges");
    expect(settings).toHaveTextContent("Integrations & health");
    expect(findActive("/charges")?.item.label).toBe("Charges & taxes");
  });

  it("switches between expanded, collapsed and expand-on-hover", () => {
    render(<Sidebar />);
    const rail = screen.getByRole("navigation", { name: "Admin sections" });
    act(() => setSidebarMode("expanded"));
    expect(rail.className).toContain("w-[212px]");
    act(() => setSidebarMode("collapsed"));
    expect(rail.className).toContain("w-14");
    expect(rail.className).not.toContain("hover:w-[212px]");
    act(() => setSidebarMode("hover"));
    expect(rail.className).toContain("hover:w-[212px]");
    expect(window.localStorage.getItem("prodbnb-admin-sidebar")).toBe("hover");
  });

  it("in expand-on-hover, collapses right after a section is clicked so its menu is not covered", () => {
    act(() => setSidebarMode("hover"));
    render(<Sidebar />);
    const rail = screen.getByRole("navigation", { name: "Admin sections" });
    expect(rail.className).toContain("hover:w-[212px]");
    const people = screen.getByRole("link", { name: "People" });
    people.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(people);
    expect(rail.className).not.toContain("hover:w-[212px]");
    fireEvent.pointerLeave(rail);
    expect(rail.className).toContain("hover:w-[212px]");
  });
});

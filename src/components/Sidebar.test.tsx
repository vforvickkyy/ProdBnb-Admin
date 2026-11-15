import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

describe("Sidebar", () => {
  it("includes a Integrations & Health navigation entry linking to /system", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Integrations & Health" })).toHaveAttribute("href", "/system");
  });

  it("marks Integrations & Health as the current page when on /system", () => {
    usePathnameMock.mockReturnValue("/system");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Integrations & Health" })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark Integrations & Health as current on an unrelated page", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Integrations & Health" })).not.toHaveAttribute("aria-current");
  });

  it("hides sections the admin's team role cannot use, keeping the always-available ones", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<Sidebar permissions={["dashboard.view", "users.view", "bookings.view"]} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bookings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin Team" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Payments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Integrations & Health" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Disputes & Messages" })).not.toBeInTheDocument();
  });

  it("shows every section while permissions are not known yet", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Payments" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analytics" })).toBeInTheDocument();
  });
});

describe("Sidebar (Admin Console 2)", () => {
  it("lights up only the most specific section for nested paths", () => {
    usePathnameMock.mockReturnValue("/messaging/email");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Announcements" })).not.toHaveAttribute("aria-current");
  });

  it("shows the new sections to roles that hold their permission", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<Sidebar permissions={["dashboard.view", "platforms.view", "locations.view"]} />);
    expect(screen.getByRole("link", { name: "Platforms & Releases" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Collections" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Announcements" })).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

describe("Sidebar", () => {
  it("includes a System Health navigation entry linking to /system", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "System Health" })).toHaveAttribute("href", "/system");
  });

  it("marks System Health as the current page when on /system", () => {
    usePathnameMock.mockReturnValue("/system");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "System Health" })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark System Health as current on an unrelated page", () => {
    usePathnameMock.mockReturnValue("/dashboard");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "System Health" })).not.toHaveAttribute("aria-current");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/dashboard" }));

describe("CommandPalette", () => {
  it("opens with Ctrl+K, filters pages, and navigates on Enter", () => {
    render(<CommandPalette can={() => true} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.change(input, { target: { value: "collections" } });
    expect(screen.getByRole("option", { name: /^Collections/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Bookings/ })).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalled();
  });

  it("offers to open a pasted id as a booking, listing, user or payment", () => {
    render(<CommandPalette can={(p) => p !== "payments.view"} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "8f1d2c3b-1111-4222-8333-944455556666" } });
    expect(screen.getByRole("option", { name: /Open booking/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Open user/ })).toBeInTheDocument();
    // Hidden when the admin's role cannot see payments.
    expect(screen.queryByRole("option", { name: /Open payment/ })).not.toBeInTheDocument();
  });

  it("hides actions the role cannot perform", () => {
    render(<CommandPalette can={(p) => p !== "campaigns.send"} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "announcement" } });
    expect(screen.queryByRole("option", { name: "New announcement" })).not.toBeInTheDocument();
  });
});

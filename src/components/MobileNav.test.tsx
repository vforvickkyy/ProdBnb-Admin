import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileNav } from "./MobileNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

describe("MobileNav", () => {
  it("is closed by default -- the drawer's nav content is not in the document", () => {
    render(<MobileNav />);
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
  });

  it("opens the drawer through the trigger, exposing every page of every section", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole("button", { name: "Menu" }));

    expect(await screen.findByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hosts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Integrations & health" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Charges & taxes" })).toBeInTheDocument();
  });

  it("gives the drawer's nav landmark a distinct accessible label from the desktop sidebar", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);
    await user.click(screen.getByRole("button", { name: "Menu" }));

    expect(await screen.findByRole("navigation", { name: "Admin sections (mobile menu)" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Admin sections" })).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByRole("link", { name: "Overview" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
  });
});

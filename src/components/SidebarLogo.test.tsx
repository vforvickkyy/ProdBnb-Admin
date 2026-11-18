import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BRAND_NAME } from "@/lib/config";
import { Logo } from "./Sidebar";

describe("Sidebar logo", () => {
  it("shows the text logo (light and dark versions) with the Admin tag when expanded, never the icon", () => {
    const { container, getByText } = render(<Logo text="show" />);
    const sources = Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src"));
    expect(sources).toEqual(["/brand/logo-wordmark.png", "/brand/logo-wordmark-light.png"]);
    expect(container.querySelectorAll(`img[alt="${BRAND_NAME}"]`)).toHaveLength(2);
    expect(getByText("Admin")).toBeTruthy();
  });

  it("shows only the square icon when the sidebar is collapsed, keeping the name for screen readers", () => {
    for (const mode of ["hidden", "hover"] as const) {
      const { container, getByText, unmount } = render(<Logo text={mode} />);
      const sources = Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src"));
      expect(sources).toEqual(["/brand/icon-192.png"]);
      expect(getByText(`${BRAND_NAME} Admin`).className).toContain("sr-only");
      unmount();
    }
  });
});

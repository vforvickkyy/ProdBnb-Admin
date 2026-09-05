import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./Badge";

describe("StatusBadge", () => {
  it("always renders the status as visible text, never color alone", () => {
    render(<StatusBadge status="suspended" />);
    expect(screen.getByText("suspended")).toBeInTheDocument();
  });

  it("replaces underscores with spaces for readability", () => {
    render(<StatusBadge status="under_review" />);
    expect(screen.getByText("under review")).toBeInTheDocument();
  });

  it("falls back to the neutral tone for an unrecognized status rather than crashing", () => {
    render(<StatusBadge status="some_future_status" />);
    expect(screen.getByText("some future status")).toBeInTheDocument();
  });
});

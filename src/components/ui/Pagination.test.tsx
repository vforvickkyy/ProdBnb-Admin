import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("wraps itself in a labeled nav landmark when a label is provided", () => {
    render(<Pagination page={1} pageSize={20} total={45} onPageChange={vi.fn()} label="Locations" />);
    expect(screen.getByRole("navigation", { name: "Locations pagination" })).toBeInTheDocument();
  });

  it("renders no extra landmark when label is omitted -- existing behavior unchanged", () => {
    render(<Pagination page={1} pageSize={20} total={45} onPageChange={vi.fn()} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("still shows the same Previous/Next/Showing content regardless of label", () => {
    render(<Pagination page={2} pageSize={20} total={45} onPageChange={vi.fn()} label="Users" />);
    expect(screen.getByText("Showing 21–40 of 45")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });
});

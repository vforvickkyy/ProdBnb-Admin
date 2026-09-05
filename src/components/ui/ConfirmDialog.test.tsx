import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("disables confirm until a reason is entered when requireReason is set", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog open title="Suspend location" requireReason confirmLabel="Suspend" onOpenChange={() => {}} onConfirm={onConfirm} />
    );

    const confirmButton = screen.getByRole("button", { name: "Suspend" });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText("Reason"), "Policy violation");
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith("Policy violation");
  });

  it("does not require a reason field at all when requireReason is false", () => {
    render(<ConfirmDialog open title="Approve" confirmLabel="Approve" onOpenChange={() => {}} onConfirm={() => {}} />);
    expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("disables the confirm button while busy, so a double-click can't double-fire the action", () => {
    render(<ConfirmDialog open title="Cancel booking" confirmLabel="Cancel" busy onOpenChange={() => {}} onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
  });
});

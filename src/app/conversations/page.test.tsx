import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonOk, jsonOkPaginated } from "@/test/apiMock";
import ConversationsPage from "./page";

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));
const BOOKER = "11111111-1111-4111-8111-111111111111";

vi.mock("@/components/AdminShell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: postMock } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`booker_id=${BOOKER}`),
}));

const summary = {
  id: "c1",
  booker: { id: BOOKER, first_name: "Rohan", last_name: "Kapoor" },
  host: { id: "h1", first_name: "Arjun", last_name: "Mehta" },
  location: { id: "l1", title: "Sunlit Loft", city: "Mumbai" },
  booking_id: null,
  message_count: 2,
  last_message_at: "2026-11-15T10:00:00Z",
  created_at: "2026-11-15T09:00:00Z",
};

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ConversationsPage />
    </SWRConfig>
  );
}

describe("Disputes & messages page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation(() => jsonOkPaginated([summary]));
  });

  it("lists matching conversations without any message text", async () => {
    renderPage();
    expect(await screen.findByText("Sunlit Loft")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/conversations", { params: { query: { booker_id: BOOKER, page: 1, pageSize: 20 } } });
  });

  it("requires a real reason before reading, sends it, and shows the transcript", async () => {
    postMock.mockImplementation(() =>
      jsonOk({
        conversation: summary,
        messages: [{ id: "m1", sender_id: "h1", sender_role: "host", body: "Pay me on UPI.", created_at: "2026-11-15T10:00:00Z" }],
        truncated: false,
        access_id: "a1",
      })
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Read…" }));
    const read = screen.getByRole("button", { name: "Record reason and read" });
    await user.type(screen.getByLabelText("Reason"), "short");
    expect(read).toBeDisabled();
    await user.type(screen.getByLabelText("Reason"), " but now long enough");
    await user.click(read);

    expect(postMock).toHaveBeenCalledWith("/conversations/{id}/access", {
      params: { path: { id: "c1" } },
      body: { reason: "short but now long enough" },
    });
    expect(await screen.findByText("Pay me on UPI.")).toBeInTheDocument();
    expect(screen.getByText(/Access recorded/)).toBeInTheDocument();
  });
});

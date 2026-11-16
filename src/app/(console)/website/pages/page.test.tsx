import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonOk, me } from "@/test/apiMock";
import WebsitePagesPage from "./page";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: vi.fn() } };
});
vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const page = (over: Record<string, unknown>) => ({
  id: "p1",
  slug: "privacy",
  title: "Privacy policy",
  body: "",
  placement: "legal",
  position: 10,
  is_published: true,
  needs_review: false,
  placeholders: [],
  updated_by: null,
  created_at: "2026-11-16T00:00:00Z",
  updated_at: "2026-11-16T00:00:00Z",
  ...over,
});

describe("Website → Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: { site: { url: "https://example.in" } } })))));
  });

  it("groups pages by footer column and flags drafts that still need review", async () => {
    getMock.mockImplementation((path: string) =>
      path === "/me"
        ? jsonOk(me("moderator", ["site.view", "content.manage"]))
        : path === "/site/contact"
          ? jsonOk({ id: "s1", primary_domain: null, support_email: null, updated_at: "2026-11-16T00:00:00Z" })
          : jsonOk([
            page({}),
            page({ id: "p2", slug: "about", title: "About us", placement: "company", needs_review: true, placeholders: ["[Company legal name]"] }),
            page({ id: "p3", slug: "safety", title: "Safety", placement: "hidden", is_published: false }),
          ]),
    );
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <WebsitePagesPage />
      </SWRConfig>,
    );
    expect(await screen.findByText("Footer · Legal")).toBeInTheDocument();
    expect(screen.getByText("Footer · Company")).toBeInTheDocument();
    expect(screen.getByText("Not in footer")).toBeInTheDocument();
    expect(screen.getByText("1 published page needs attention.")).toBeInTheDocument();
    expect(screen.getByText("1 blank to fill")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /About us/ })).toHaveAttribute("href", "/website/pages/p2");
    expect(screen.getByRole("button", { name: /New page/ })).toBeInTheDocument();
    expect(await screen.findByText("Not set: pages link to the Contact page instead.")).toBeInTheDocument();
  });
});

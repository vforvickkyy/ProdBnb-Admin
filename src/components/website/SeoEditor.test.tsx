import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonOk } from "@/test/apiMock";
import { SeoEditor } from "./SeoEditor";

const { getMock, putMock } = vi.hoisted(() => ({ getMock: vi.fn(), putMock: vi.fn() }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, PUT: putMock } };
});

const auto = {
  title: "Sunlit loft, Mumbai · ProdBnb",
  description: "A bright loft with big windows.",
  path: "/locations/sunlit-loft-mumbai-l1",
};

function renderEditor(canEdit = true) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <SeoEditor type="location" entityKey="l1" auto={auto} canEdit={canEdit} />
    </SWRConfig>,
  );
}

describe("SeoEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: { site: { url: "https://example.in" } } })))));
  });

  it("previews the automatic title and description when nothing is overridden", async () => {
    getMock.mockImplementation(() => jsonOk(null));
    renderEditor();
    const preview = await screen.findByLabelText("Search result preview");
    expect(preview).toHaveTextContent(auto.title);
    expect(preview).toHaveTextContent(auto.description);
    expect(screen.queryByRole("button", { name: "Reset to automatic" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save SEO" })).toBeDisabled();
  });

  it("saves only what was typed; empty fields go as null (automatic)", async () => {
    getMock.mockImplementation(() => jsonOk(null));
    putMock.mockImplementation(() => jsonOk({ id: "o1" }));
    const user = userEvent.setup();
    renderEditor();
    await user.type(await screen.findByLabelText("Search title"), "Rooftop for music videos in Bandra");
    expect(screen.getByLabelText("Search result preview")).toHaveTextContent("Rooftop for music videos in Bandra");
    await user.click(screen.getByRole("button", { name: "Save SEO" }));
    expect(putMock).toHaveBeenCalledWith("/site/seo/{type}/{key}", {
      params: { path: { type: "location", key: "l1" } },
      body: { meta_title: "Rooftop for music videos in Bandra", meta_description: null, og_image_url: null, noindex: false },
    });
  });

  it("resets a custom override back to automatic", async () => {
    getMock.mockImplementation(() =>
      jsonOk({ meta_title: "Custom", meta_description: null, og_image_url: null, noindex: true, updated_at: "2026-11-16T00:00:00Z" }),
    );
    putMock.mockImplementation(() => jsonOk(null));
    const user = userEvent.setup();
    renderEditor();
    expect(await screen.findByText(/Hidden from search engines/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset to automatic" }));
    expect(putMock).toHaveBeenCalledWith("/site/seo/{type}/{key}", {
      params: { path: { type: "location", key: "l1" } },
      body: { meta_title: null, meta_description: null, og_image_url: null, noindex: false },
    });
  });

  it("is read-only without content.manage", async () => {
    getMock.mockImplementation(() => jsonOk(null));
    renderEditor(false);
    expect(await screen.findByLabelText("Search title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save SEO" })).not.toBeInTheDocument();
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonOk, jsonOkPaginated, me } from "@/test/apiMock";
import ComposePage from "./page";

const { getMock, postMock, push } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: postMock, PATCH: vi.fn() } };
});
vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
const search = vi.hoisted(() => ({ value: "channel=push" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));

const TEMPLATES = [
  {
    id: "t-listing",
    name: "New listing",
    category: "new_listing",
    description: null,
    needs: "listing",
    title: "New in {listing_city}: {listing_title}",
    body: "Hi {first_name|there}, from {listing_price}.",
    email_subject: null,
    email_body: null,
    channels: ["in_app", "push"],
    is_builtin: true,
    created_at: "",
    updated_at: "",
    uses: 0,
  },
];
const VARIABLES = [
  { key: "first_name", label: "First name", example: "Riya", scope: "person" },
  { key: "listing_title", label: "Listing name", example: "Loft", scope: "listing" },
];

describe("Compose a notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search.value = "channel=push";
  });

  it("starts from a template, asks for the listing, previews it personally and sends it to a group", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/me") return jsonOk(me("support", ["campaigns.view", "campaigns.send"]));
      if (path === "/messaging/overview") return jsonOk({ readiness: { email: false, push: { ios: true, android: true, web: true } }, jobs: { enabled: true } });
      if (path === "/notification-templates") return jsonOk(TEMPLATES);
      if (path === "/notification-variables") return jsonOk(VARIABLES);
      if (path === "/locations") return jsonOkPaginated([{ id: "loc-1", title: "Rooftop with a view", city: "Pune" }]);
      if (path === "/campaigns/audience-options")
        return jsonOk({ professions: [{ value: "director", label: "Director", count: 4 }], cities: [{ name: "Pune", count: 9 }], use_cases: [], onboarded: 12 });
      return jsonOk(null);
    });
    postMock.mockImplementation((path: string, init: { body: Record<string, unknown> }) => {
      if (path === "/campaigns/audience-preview") return jsonOk({ users: 7, with_email: 5, devices: { ios: 2, android: 1, web: 0 } });
      if (path === "/campaigns/render-preview") {
        if (!init.body.location_id) return Promise.resolve({ data: undefined, error: { error: { message: "This text uses listing details ({listing_…}). Pick the listing it's about." } }, response: { status: 400 } });
        return jsonOk({ title: "New in Pune: Rooftop with a view", body: "Hi Test, from ₹2,500/hour.", link_url: "prodbnb://location/loc-1", email_subject: null, email_body: null, user_id: "u-me", missing: [] });
      }
      if (path === "/campaigns") return jsonOk({ id: "c-1" });
      if (path === "/campaigns/{campaignId}/send") return jsonOk({ id: "c-1", status: "sent" });
      return jsonOk(null);
    });
    const user = userEvent.setup();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ComposePage />
      </SWRConfig>,
    );

    await user.click(await screen.findByRole("radio", { name: "New listing" }));
    expect(screen.getByLabelText("Title")).toHaveValue("New in {listing_city}: {listing_title}");
    expect(screen.getByLabelText("Internal name")).toHaveValue("New listing");
    expect(await screen.findByText("Pick the listing it's about.")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Rooftop with a view/ }));
    expect(await screen.findByText("New in Pune: Rooftop with a view")).toBeInTheDocument();
    expect(screen.getByText("Hi Test, from ₹2,500/hour.")).toBeInTheDocument();
    expect(screen.queryByText("Pick the listing it's about.")).not.toBeInTheDocument();

    // One click targets people interested in the listing's city.
    await user.click(screen.getByRole("button", { name: "Send it to people interested in Pune" }));
    const cities = await screen.findByRole("group", { name: "Cities" });
    expect(within(cities).getByRole("checkbox", { name: /Pune/ })).toHaveAttribute("aria-checked", "true");
    await user.click(within(screen.getByRole("group", { name: "What they do" })).getByRole("checkbox", { name: /Director/ }));

    // A variable goes in where the cursor is.
    const message = screen.getByLabelText("Message");
    await user.click(message);
    await user.keyboard("{End}");
    await user.click(screen.getByRole("button", { name: "{listing_title}" }));
    expect(message).toHaveValue("Hi {first_name|there}, from {listing_price}.{listing_title}");

    await user.click(await screen.findByRole("button", { name: "Send to 7" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/marketing/c-1"));
    expect(postMock).toHaveBeenCalledWith(
      "/campaigns",
      expect.objectContaining({
        body: expect.objectContaining({
          location_id: "loc-1",
          template_id: "t-listing",
          audience: { type: "segment", cities: ["Pune"], professions: ["director"] },
        }),
      }),
    );
  });

  it("builds an email campaign: picks a design and listings, shows who gets it, previews the real email and sends email only", async () => {
    search.value = "channel=email";
    getMock.mockImplementation((path: string) => {
      if (path === "/me") return jsonOk(me("support", ["campaigns.view", "campaigns.send"]));
      if (path === "/messaging/overview") return jsonOk({ readiness: { email: true, push: { ios: false, android: false, web: false } }, jobs: { enabled: true } });
      if (path === "/notification-templates") return jsonOk([]);
      if (path === "/notification-variables") return jsonOk(VARIABLES);
      if (path === "/locations")
        return jsonOkPaginated([
          { id: "loc-1", title: "Rooftop with a view", city: "Pune" },
          { id: "loc-2", title: "Sea-facing Loft", city: "Mumbai" },
        ]);
      return jsonOk(null);
    });
    postMock.mockImplementation((path: string) => {
      if (path === "/campaigns/audience-preview")
        return jsonOk({ users: 10, with_email: 6, email: { will_receive: 6, unsubscribed: 3, bounced: 0, no_email: 1 }, devices: { ios: 0, android: 0, web: 0 } });
      if (path === "/campaigns/render-preview")
        return jsonOk({ title: "x", body: "x", link_url: null, email_subject: "Rooftops", email_body: "Hi", user_id: "u-me", missing: [], email_html: "<html lang=\"en\"><body>EMAIL</body></html>", email_problem: null });
      if (path === "/campaigns") return jsonOk({ id: "c-2" });
      if (path === "/campaigns/{campaignId}/send") return jsonOk({ id: "c-2", status: "sending" });
      return jsonOk(null);
    });
    const user = userEvent.setup();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ComposePage />
      </SWRConfig>,
    );

    expect(await screen.findByRole("heading", { name: "New email campaign" })).toBeInTheDocument();
    // No channel choice: it's an email.
    expect(screen.queryByRole("checkbox", { name: /Push notification/ })).not.toBeInTheDocument();
    expect(await screen.findByText("6 will get the email")).toBeInTheDocument();
    expect(screen.getByText("3 unsubscribed from news")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Listing collection/ }));
    await user.click(await screen.findByRole("button", { name: /Rooftop with a view/ }));
    await user.click(await screen.findByRole("button", { name: /Sea-facing Loft/ }));
    await user.type(screen.getByLabelText("Internal name"), "Rooftops");
    await user.type(screen.getByLabelText("Subject"), "Rooftops");
    await user.type(screen.getByLabelText("Message"), "Hi");
    expect(await screen.findByTitle("Email preview")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Send to 10" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/marketing/c-2"));
    expect(postMock).toHaveBeenCalledWith(
      "/campaigns",
      expect.objectContaining({
        body: expect.objectContaining({ channels: ["email"], email_design: "collection", email_location_ids: ["loc-1", "loc-2"], title: "Rooftops" }),
      }),
    );
  });
});

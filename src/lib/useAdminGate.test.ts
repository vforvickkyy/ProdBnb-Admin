import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, onAuthStateChangeMock, getMeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  getMeMock: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: getSessionMock, onAuthStateChange: onAuthStateChangeMock } },
}));
vi.mock("./api", () => ({ getMe: getMeMock }));

import { useAdminGate } from "./useAdminGate";

// SWR's default cache is a module-level singleton -- without a fresh
// provider per test, one test's cached "/v1/me" response leaks into the
// next render of the same hook, even with the mock reconfigured.
function renderGate() {
  return renderHook(() => useAdminGate(), {
    wrapper: ({ children }) => createElement(SWRConfig, { value: { provider: () => new Map() } }, children),
  });
}

describe("useAdminGate", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reports signed-out when there is no Supabase session at all", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    const { result } = renderGate();
    await waitFor(() => expect(result.current).toBe("signed-out"));
    expect(getMeMock).not.toHaveBeenCalled();
  });

  it("reports not-admin for an authenticated user without the admin role", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "t" } } });
    getMeMock.mockResolvedValue({ data: { profile: { id: "u1" }, roles: ["booker"] } });
    const { result } = renderGate();
    await waitFor(() => expect(result.current).toBe("not-admin"));
  });

  it("reports admin only when the roles array actually includes 'admin'", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "t" } } });
    getMeMock.mockResolvedValue({ data: { profile: { id: "u1" }, roles: ["booker", "admin"] } });
    const { result } = renderGate();
    await waitFor(() => expect(result.current).toBe("admin"));
  });

  it("treats a failed /v1/me call the same as signed-out, not a crash", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "t" } } });
    getMeMock.mockRejectedValue(new Error("401"));
    const { result } = renderGate();
    await waitFor(() => expect(result.current).toBe("signed-out"));
  });
});

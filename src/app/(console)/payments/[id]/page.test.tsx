import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import PaymentDetailPage from "./page";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

// See src/app/users/[id]/page.test.tsx for why `use` needs a polyfill under
// this project's pinned React 18.3 when running outside Next's own build.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  function usePolyfill<T>(promise: Promise<T> & { status?: string; value?: T; reason?: unknown }): T {
    if (promise.status === "fulfilled") return promise.value as T;
    if (promise.status === "rejected") throw promise.reason;
    if (promise.status === undefined) {
      promise.status = "pending";
      promise.then(
        (v) => {
          promise.status = "fulfilled";
          promise.value = v;
        },
        (e) => {
          promise.status = "rejected";
          promise.reason = e;
        }
      );
    }
    throw promise;
  }
  return { ...actual, use: usePolyfill };
});

vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: vi.fn() } };
});

/**
 * Minimal, scoped to the Phase 14-B4 accessibility fix only (loading state
 * gets role="status") -- this page had no test file before B4, and a full
 * behavioral backfill is explicitly out of scope for this change.
 */
describe("Payment detail page — loading state accessibility", () => {
  it("wraps the loading skeleton in role=status while the detail fetch is pending", async () => {
    getMock.mockImplementation(() => new Promise(() => {}));

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Suspense fallback={<div>Resolving route…</div>}>
          <PaymentDetailPage params={Promise.resolve({ id: "p1" })} />
        </Suspense>
      </SWRConfig>
    );

    expect(await screen.findByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});

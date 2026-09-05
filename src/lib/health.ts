// GET /health/ready is a public, unauthenticated backend endpoint (no
// bearer token, not part of the /v1/admin/* OpenAPI contract) -- it exists
// specifically so uptime tooling (and, here, the System Health page) can
// check readiness without any admin session. A plain fetch, not adminApi.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type ReadinessStatus = "ready" | "not-ready";

export async function getReadiness(): Promise<ReadinessStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/health/ready`);
    return res.ok ? "ready" : "not-ready";
  } catch {
    // A network failure means the backend isn't reachable -- exactly the
    // condition this check exists to surface, not a page-breaking error.
    return "not-ready";
  }
}

/** Shared helpers for page tests that mock `adminApi`. */
export function jsonOk(data: unknown) {
  return Promise.resolve({ data: { data }, error: undefined, response: { status: 200 } });
}

export function jsonOkPaginated(rows: unknown[]) {
  return Promise.resolve({ data: { data: rows, meta: { page: 1, pageSize: 20, total: rows.length } }, error: undefined, response: { status: 200 } });
}

export function me(team_role: "super_admin" | "moderator" | "support" | "finance", permissions: string[]) {
  return { user_id: "u-me", email: "me@example.com", first_name: "Test", last_name: "Admin", team_role, permissions };
}

import { describe, expect, it } from "vitest";
import { ApiError, unwrap, unwrapPaginated } from "./api";

const okResponse = { status: 200 } as Response;
const errResponse = { status: 403 } as Response;

describe("unwrap", () => {
  it("peels the single { data } envelope", () => {
    const result = unwrap<{ id: string }>({ data: { data: { id: "abc" } }, response: okResponse });
    expect(result).toEqual({ id: "abc" });
  });

  it("throws an ApiError carrying the backend's real message and code", () => {
    expect(() =>
      unwrap({ error: { error: { message: "Not an admin.", code: "FORBIDDEN" } }, response: errResponse })
    ).toThrowError(ApiError);

    try {
      unwrap({ error: { error: { message: "Not an admin.", code: "FORBIDDEN" } }, response: errResponse });
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe("Not an admin.");
      expect((err as ApiError).code).toBe("FORBIDDEN");
      expect((err as ApiError).status).toBe(403);
    }
  });

  it("falls back to a generic message when the error body has no message", () => {
    try {
      unwrap({ error: {}, response: errResponse });
      throw new Error("expected unwrap to throw");
    } catch (err) {
      expect((err as ApiError).message).toBe("Request failed (403).");
    }
  });
});

describe("unwrapPaginated", () => {
  it("returns the list and meta together, unmodified", () => {
    const meta = { page: 1, pageSize: 20, total: 2 };
    const result = unwrapPaginated<{ id: string }>({ data: { data: [{ id: "a" }, { id: "b" }], meta }, response: okResponse });
    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual(meta);
  });

  it("throws on error the same way unwrap does", () => {
    expect(() => unwrapPaginated({ error: { error: { message: "boom" } }, response: errResponse })).toThrowError(ApiError);
  });
});

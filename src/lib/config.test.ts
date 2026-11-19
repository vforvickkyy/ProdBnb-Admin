import { describe, expect, it } from "vitest";
import { consoleEnvironment } from "./config";

describe("consoleEnvironment", () => {
  it("reads the header badge from the API address", () => {
    expect(consoleEnvironment("https://api.heken.co")).toBe("production");
    expect(consoleEnvironment("https://api.heken.co/")).toBe("production");
    expect(consoleEnvironment("https://api-staging.heken.co")).toBe("staging");
    expect(consoleEnvironment("https://prodbnb-backend-staging.vercel.app")).toBe("staging");
    expect(consoleEnvironment("http://localhost:4000")).toBe("local");
    expect(consoleEnvironment("https://something-else.vercel.app")).toBe("unknown");
    expect(consoleEnvironment("")).toBe("unknown");
  });
});

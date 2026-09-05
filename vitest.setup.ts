import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// @testing-library/react's own auto-cleanup only self-registers when it
// finds a global `afterEach` -- this project deliberately doesn't enable
// vitest's `globals: true` (every test file imports describe/it/expect/vi
// explicitly instead), so that auto-registration never fires. Without this,
// a component rendered in one test (e.g. a Dialog's portal content) stays
// mounted in the DOM for the next test in the same file.
afterEach(() => {
  cleanup();
});

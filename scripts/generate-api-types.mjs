// Regenerates src/types/admin-api.d.ts from the backend's committed OpenAPI contract.
//
// The backend repo is a sibling checkout whose folder name differs by machine ("ProdBnb Backend"
// on the original Mac, "ProdBnb.Backend" in a fresh `git clone`), so this looks for the contract in
// each known spelling instead of hard-coding one. Override with ADMIN_OPENAPI=/path/to/admin-openapi.json.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const candidates = [
  process.env.ADMIN_OPENAPI,
  "../ProdBnb.Backend/docs/admin-openapi.json",
  "../ProdBnb Backend/docs/admin-openapi.json",
  "../prodbnb.backend/docs/admin-openapi.json",
  "../ProdBnb-Backend/docs/admin-openapi.json",
].filter(Boolean);

const source = candidates.map((p) => resolve(p)).find((p) => existsSync(p));
if (!source) {
  console.error(`Could not find the backend OpenAPI contract. Looked in:\n  ${candidates.join("\n  ")}\nSet ADMIN_OPENAPI to its path.`);
  process.exit(1);
}

execFileSync("npx", ["openapi-typescript", source, "-o", "src/types/admin-api.d.ts"], { stdio: "inherit" });

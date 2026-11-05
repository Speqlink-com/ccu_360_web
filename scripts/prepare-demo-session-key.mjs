import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const folder = fileURLToPath(new URL("../lib/server/", import.meta.url));
mkdirSync(folder, { recursive: true });
// A deployment-scoped private build artifact, not a checked-in credential.
writeFileSync(
  new URL("../lib/server/.demo-session-key", import.meta.url),
  randomBytes(32).toString("hex"),
  { mode: 0o600 },
);
console.log("Prepared the private demo session signing artifact.");

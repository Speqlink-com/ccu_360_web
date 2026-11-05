import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
const devRuntime = globalThis as typeof globalThis & {
  __ccu360DevSigningKey?: string;
};
export function demoSigningKey() {
  const configured = process.env.DEMO_SESSION_SECRET;
  if (configured) {
    if (configured.length < 32)
      throw new Error(
        "DEMO_SESSION_SECRET must contain at least 32 characters.",
      );
    return configured;
  }
  if (process.env.NODE_ENV !== "production")
    return (devRuntime.__ccu360DevSigningKey ??=
      randomBytes(32).toString("hex"));
  // Generated once per build, traced into every Vercel function; never served publicly.
  const key = readFileSync(
    join(process.cwd(), "lib/server/.demo-session-key"),
    "utf8",
  ).trim();
  if (key.length < 32)
    throw new Error(
      "The demo signing key is missing. Build with npm run build.",
    );
  return key;
}

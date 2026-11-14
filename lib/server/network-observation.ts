import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";

// Vercel overwrites this platform header. Outside Vercel, forwarding headers
// are untrusted and no browser address is asserted. Never forward caller proofs.
export function signedNetworkHeaders(
  request: Request,
  path: string,
  body: Uint8Array | string | undefined,
  env: Record<string, string | undefined> = process.env,
  now = Date.now(),
): Record<string, string> {
  const secret = env.WORKSITE_PROXY_SECRET;
  if (
    !path.startsWith("worksite/") ||
    env.VERCEL !== "1" ||
    !secret ||
    secret.length < 32
  )
    return {};
  const address = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (!address || !isIP(address)) return {};
  const timestamp = String(Math.floor(now / 1000));
  const payload = [
    timestamp,
    request.method,
    `/api/v1/${path}`,
    address,
    createHash("sha256")
      .update(body ?? "")
      .digest("hex"),
  ].join("\n");
  return {
    "X-CCU360-Network-IP": address,
    "X-CCU360-Network-Time": timestamp,
    "X-CCU360-Network-Signature": createHmac("sha256", secret)
      .update(payload)
      .digest("hex"),
  };
}

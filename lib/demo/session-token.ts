import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
const lifetime = 8 * 60 * 60_000;
const claimsSchema = z.object({
  userId: z.string().min(1).max(160),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
  nonce: z.string().uuid(),
});
export function issueDemoSession(
  userId: string,
  key: string,
  now = Date.now(),
) {
  if (key.length < 32)
    throw new Error(
      "A demo signing key of at least 32 characters is required.",
    );
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      issuedAt: now,
      expiresAt: now + lifetime,
      nonce: randomUUID(),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", key)
    .update(`v1.${payload}`)
    .digest("base64url");
  return `v1.${payload}.${signature}`;
}
export function verifyDemoSession(
  token: string | undefined,
  key: string,
  now = Date.now(),
) {
  if (!token || token.length > 1024 || key.length < 32) return null;
  const [version, payload, signature, extra] = token.split(".");
  if (version !== "v1" || !payload || !signature || extra !== undefined)
    return null;
  if (
    !/^[A-Za-z0-9_-]+$/.test(payload) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  )
    return null;
  const expected = createHmac("sha256", key).update(`v1.${payload}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (
    actual.toString("base64url") !== signature ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return null;
  try {
    const claims = claimsSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    if (
      claims.expiresAt <= now ||
      claims.issuedAt > now + 30_000 ||
      claims.expiresAt - claims.issuedAt !== lifetime
    )
      return null;
    return claims;
  } catch {
    return null;
  }
}

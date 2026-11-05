import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createControlPlane } from "../lib/demo/control-plane";
import { issueDemoSession, verifyDemoSession } from "../lib/demo/session-token";
test("a login survives a fresh Vercel function instance sharing the build signing key", () => {
  const key = randomBytes(32).toString("hex");
  const loginFunction = createControlPlane({ signingKey: key });
  const result = loginFunction.login(
    "comphortine@ayothealthsolutions.ke",
    "Ahs360!Demo26",
  );
  const dashboardFunction = createControlPlane({ signingKey: key });
  assert.equal(dashboardFunction.session(result.token)?.user.role, "ahs_admin");
  const userFunction = createControlPlane({ signingKey: key });
  const doctor = loginFunction.login("doctor@cedar.ccu360.test", "Doctor!360");
  assert.equal(userFunction.session(doctor.token)?.facility?.id, "fac-cedar");
  assert.equal(
    userFunction.workspace(userFunction.session(doctor.token)!.user).facilityId,
    "fac-cedar",
  );
});
test("portable sessions reject modified claims, a different signing key and expired cookies", () => {
  const key = randomBytes(32).toString("hex"),
    now = Date.now(),
    token = issueDemoSession("usr-ahs", key, now);
  assert.equal(verifyDemoSession(token, key, now)?.userId, "usr-ahs");
  assert.equal(
    verifyDemoSession(token, randomBytes(32).toString("hex"), now),
    null,
  );
  const [version, payload, signature] = token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  claims.userId = "usr-cedar-admin";
  const altered = `${version}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;
  assert.equal(verifyDemoSession(altered, key, now), null);
  assert.equal(verifyDemoSession(token, key, now + 8 * 60 * 60_000), null);
  assert.equal(verifyDemoSession("garbage", key, now), null);
  assert.equal(verifyDemoSession(token + ".extra", key, now), null);
  assert.equal(verifyDemoSession(token + "!", key, now), null);
});

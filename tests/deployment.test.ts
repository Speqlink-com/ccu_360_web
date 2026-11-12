import assert from "node:assert/strict";
import { test } from "node:test";
import { apiProxyOrigin, verifyProductionMode } from "../lib/deployment";

test("API transport proxy permits only the configured CCU360 origin", () => {
  assert.equal(apiProxyOrigin(undefined), undefined);
  assert.equal(apiProxyOrigin("https://api.ccu360.health/"), "https://api.ccu360.health");
  for (const value of ["http://api.ccu360.health", "https://api.ccu360.health.evil.test", "https://api.ccu360.health/private", "http://127.0.0.1:8000"])
    assert.throws(() => apiProxyOrigin(value));
});

test("Vercel production cannot enable the demo accounts", () => {
  assert.throws(() => verifyProductionMode("production", "true"));
  assert.doesNotThrow(() => verifyProductionMode("production", "false"));
  assert.doesNotThrow(() => verifyProductionMode("preview", "true"));
});

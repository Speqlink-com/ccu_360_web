import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import { NextRequest } from "next/server";
import {
  allowedGatewayPath,
  validGatewayQuery,
  identityGateway,
} from "../lib/server/identity-gateway";
import { signedNetworkHeaders } from "../lib/server/network-observation";
import { authCookieNames } from "../lib/server/auth-cookies";
import {
  hasLocationAccess,
  connectionNotice,
  worksiteStatus,
} from "../features/worksite/contract";
import { safeSocketUrl } from "../features/communication/contract";
import { createCommunicationUI } from "../store/communication-ui";
const id = "11111111-1111-4111-8111-111111111111";
test("unverified network information never replaces the server location decision", () => {
  const status = worksiteStatus.parse({
    exempt: false,
    required: true,
    allowed: false,
    network: {
      source: "unverified_gateway",
      trusted_network: null,
      verification: "unverified",
      reason: "signature_mismatch",
      support_reference: id,
    },
  });
  assert.equal(hasLocationAccess(status, Date.now()), false);
  assert.match(connectionNotice(status.network)!, /still verify your location/);
  assert.equal(
    hasLocationAccess(
      {
        ...status,
        allowed: true,
        expires_at: new Date(Date.now() + 30_000).toISOString(),
      },
      Date.now(),
    ),
    true,
  );
  assert.equal(status.network?.trusted_network, null);
  assert.match(
    connectionNotice({
      source: "signed_web_gateway",
      trusted_network: { id, name: "Synthetic WAN" },
    })!,
    /Synthetic WAN/,
  );
});
test("feature gateway permits exact HTTP contracts and rejects method escalation", () => {
  for (const [method, path] of [
    ["GET", "worksite/status"],
    ["PUT", "worksite/policy"],
    ["POST", "worksite/location/challenges"],
    ["POST", "worksite/location/attestations"],
    ["GET", `communication/conversations/${id}/messages/${id}/revisions`],
    ["POST", "communication/realtime/tickets"],
    ["PUT", `communication/conversations/${id}/read-receipt`],
    ["PATCH", `communication/conversations/${id}/messages/${id}`],
  ])
    assert.equal(allowedGatewayPath(path, method), true);
  for (const [method, path] of [
    ["GET", "communication/realtime/tickets"],
    ["DELETE", "worksite/policy"],
    ["POST", "worksite/policy"],
    ["POST", `communication/conversations/${id}/members`],
    ["GET", "communication/realtime"],
    ["GET", "communication/../../auth/me"],
  ])
    assert.equal(allowedGatewayPath(path, method), false);
});
test("bounded cursor parameters are resource-specific, duplicate-safe and precise", () => {
  assert.equal(
    validGatewayQuery(
      "communication/events",
      new URLSearchParams("after_sequence=9007199254740991&limit=100"),
    ),
    true,
  );
  assert.equal(
    validGatewayQuery(
      `communication/conversations/${id}/messages`,
      new URLSearchParams("before_sequence=42"),
    ),
    true,
  );
  for (const query of [
    "after_sequence=9007199254740992",
    "after_sequence=-1",
    "limit=20&limit=100",
    "ticket=secret",
  ])
    assert.equal(
      validGatewayQuery("communication/events", new URLSearchParams(query)),
      false,
    );
  assert.equal(
    validGatewayQuery(
      "worksite/status",
      new URLSearchParams("after_sequence=42"),
    ),
    false,
  );
});
test("worksite grant expires locally and exemptions retain the server decision", () => {
  const status = {
    exempt: false,
    required: true,
    allowed: true,
    expires_at: new Date(100_000).toISOString(),
  };
  assert.equal(hasLocationAccess(status, 99_999), true);
  assert.equal(hasLocationAccess(status, 100_000), false);
  assert.equal(
    hasLocationAccess({ ...status, expires_at: undefined }, 1),
    false,
  );
  assert.equal(hasLocationAccess({ ...status, exempt: true }, 200_000), true);
  assert.equal(
    hasLocationAccess({ ...status, exempt: true, allowed: false }, 1),
    false,
  );
});
test("socket tickets cannot redirect browser credentials to another destination", () => {
  assert.equal(
    safeSocketUrl(
      "wss://api.ccu360.health/api/v1/communication/realtime",
      "https://ccu360.health",
    ),
    "wss://api.ccu360.health/api/v1/communication/realtime",
  );
  assert.match(
    safeSocketUrl(
      "ws://127.0.0.1:8100/api/v1/communication/realtime",
      "http://localhost:3106",
    ),
    /^ws:/,
  );
  for (const url of [
    "wss://evil.test/api/v1/communication/realtime",
    "wss://api.ccu360.health/api/v1/communication/realtime?ticket=x",
    "wss://user:pass@api.ccu360.health/api/v1/communication/realtime",
    "ws://127.0.0.1:8100/api/v1/communication/realtime",
  ])
    assert.throws(() => safeSocketUrl(url, "https://ccu360.health"));
});
test("trusted-network proofs use the Vercel client observation and exact forwarded body", () => {
  const request = new Request(
    "https://ccu360.health/api/v1/worksite/location/attestations",
    {
      method: "POST",
      headers: {
        "x-vercel-forwarded-for": "8.8.8.8",
        "x-forwarded-for": "1.1.1.1",
        "x-ccu360-network-ip": "9.9.9.9",
      },
    },
  );
  const key = "synthetic-server-secret-with-more-than-thirty-two-characters",
    body = '{"latitude":1}';
  const headers = signedNetworkHeaders(
    request,
    "worksite/location/attestations",
    body,
    { VERCEL: "1", WORKSITE_PROXY_SECRET: key },
    100000,
  );
  assert.equal(headers["X-CCU360-Network-IP"], "8.8.8.8");
  assert.equal(
    headers["X-CCU360-Network-Signature"],
    createHmac("sha256", key)
      .update(
        [
          "100",
          "POST",
          "/api/v1/worksite/location/attestations",
          "8.8.8.8",
          createHash("sha256").update(body).digest("hex"),
        ].join("\n"),
      )
      .digest("hex"),
  );
  assert.deepEqual(
    signedNetworkHeaders(request, "worksite/status", undefined, {
      WORKSITE_PROXY_SECRET: key,
    }),
    {},
  );
  assert.deepEqual(
    signedNetworkHeaders(request, "worksite/status", undefined, {
      VERCEL: "1",
    }),
    {},
  );
});
test("gateway passes safe problem codes and browser origin without exposing session cookies", async () => {
  const request = new NextRequest(
    "https://ccu360.health/api/v1/communication/realtime/tickets",
    {
      method: "POST",
      headers: {
        origin: "https://ccu360.health",
        "content-type": "application/json",
        cookie: `${authCookieNames().access}=synthetic-access`,
      },
      body: "{}",
    },
  );
  const response = await identityGateway(
    request,
    "communication/realtime/tickets",
    async (_url, init) => {
      assert.equal(
        (init?.headers as Record<string, string>).Origin,
        "https://ccu360.health",
      );
      assert.equal((init?.headers as Record<string, string>).Cookie, undefined);
      return new Response(
        JSON.stringify({
          title: "worksite_location_required",
          detail: "must_not_override",
        }),
        {
          status: 403,
          headers: { "content-type": "application/problem+json" },
        },
      );
    },
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "worksite_location_required");
});
test("communication UI is isolated per app instance and reset discards selection", () => {
  const first = createCommunicationUI(),
    second = createCommunicationUI();
  first.getState().bindScope("provider-a:user-a");
  first.getState().setCursor(42);
  first.getState().bindScope("provider-a:user-a");
  assert.equal(first.getState().cursor, 42);
  first.getState().select(id);
  first.getState().setConnection("live");
  assert.equal(second.getState().selected, null);
  first.getState().bindScope("provider-b:user-a");
  assert.equal(first.getState().cursor, 0);
  assert.equal(first.getState().selected, null);
  first.getState().reset();
  assert.equal(first.getState().selected, null);
  assert.equal(first.getState().connection, "offline");
});

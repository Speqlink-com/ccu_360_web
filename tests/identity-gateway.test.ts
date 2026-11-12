import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import {
  identityGateway,
  mutationOriginAllowed,
  upstreamOrigin,
  allowedGatewayPath,
} from "../lib/server/identity-gateway";
import { authCookieNames } from "../lib/server/auth-cookies";
import { collectEntryValues } from "../features/live/entry-values";
import { createIdentityUI } from "../store/identity-ui";
import type { Section } from "../features/live/journey-contract";
const cookie = authCookieNames();
const base = "https://ccu360.health/api/v1/";
function request(
  path: string,
  method = "POST",
  data: unknown = {},
  cookies = "",
) {
  return new NextRequest(base + path, {
    method,
    headers: {
      origin: "https://ccu360.health",
      "Content-Type": "application/json",
      cookie: cookies,
    },
    ...(method !== "GET" ? { body: JSON.stringify(data) } : {}),
  });
}
const tokens = {
  access_token: "synthetic-access-token-with-sufficient-length",
  refresh_token: "synthetic-refresh-token-with-at-least-32-characters",
  expires_in: 600,
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
test("gateway stores tokens only in HttpOnly cookies and never returns them to browser code", async () => {
  const response = await identityGateway(
    request("auth/login"),
    "auth/login",
    async () => json(tokens),
  );
  assert.deepEqual(await response.json(), { step: "authenticated" });
  assert.equal(response.cookies.get(cookie.access)?.value, tokens.access_token);
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/i);
  assert.match(response.headers.get("set-cookie")!, /SameSite=lax/i);
  assert.match(response.headers.get("cache-control")!, /no-store/);
});
test("MFA challenge is kept in an HttpOnly cookie and injected by the server", async () => {
  const challenge = "synthetic-challenge-token-that-is-long-enough";
  const login = await identityGateway(
    request("auth/login"),
    "auth/login",
    async () => json({ mfa_required: true, challenge_token: challenge }),
  );
  assert.deepEqual(await login.json(), { step: "verify" });
  assert.equal(login.cookies.get(cookie.challenge)?.value, challenge);
  let body: unknown;
  await identityGateway(
    request(
      "auth/mfa/verify",
      "POST",
      { code: "123456", challenge_token: "forged" },
      `${cookie.challenge}=${challenge}`,
    ),
    "auth/mfa/verify",
    async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return json(tokens);
    },
  );
  assert.deepEqual(body, { code: "123456", challenge_token: challenge });
});
test("restricted enrollment token is used only for MFA enrollment; recovery codes are returned once", async () => {
  const enrollment = "synthetic-enrollment-token-with-sufficient-length";
  const login = await identityGateway(
    request("auth/login"),
    "auth/login",
    async () =>
      json({ mfa_enrollment_required: true, enrollment_token: enrollment }),
  );
  assert.deepEqual(await login.json(), { step: "enroll" });
  let authorization = "";
  const response = await identityGateway(
    request(
      "auth/mfa/totp/confirm",
      "POST",
      { code: "123456" },
      `${cookie.enrollment}=${enrollment}`,
    ),
    "auth/mfa/totp/confirm",
    async (_url, init) => {
      authorization = (init?.headers as Record<string, string>).Authorization;
      return json({ ...tokens, recovery_codes: ["single-use-synthetic-code"] });
    },
  );
  assert.equal(authorization, "Bearer " + enrollment);
  assert.deepEqual(await response.json(), {
    step: "authenticated",
    recovery_codes: ["single-use-synthetic-code"],
  });
  const denied = await identityGateway(
    request("identity/users", "GET", {}, `${cookie.enrollment}=${enrollment}`),
    "identity/users",
    async () => {
      throw new Error("must not run");
    },
  );
  assert.equal(denied.status, 401);
});
test("cross-origin mutations, missing origins and unapproved paths fail before network access", async () => {
  for (const origin of ["https://evil.example", "null", ""]) {
    const req = new NextRequest(base + "auth/login", {
      method: "POST",
      headers: { origin },
      body: "{}",
    });
    assert.equal(mutationOriginAllowed(req), false);
    assert.equal(
      (
        await identityGateway(req, "auth/login", async () => {
          throw new Error("must not run");
        })
      ).status,
      403,
    );
  }
  for (const path of [
    "../auth/me",
    "auth/me/other",
    "journey/%2e%2e",
    "https://evil.example",
  ])
    assert.equal(allowedGatewayPath(path, "GET"), false);
  assert.throws(() => upstreamOrigin("https://evil.example"));
  assert.throws(() => upstreamOrigin("https://api.ccu360.health@evil.example"));
  assert.throws(() => upstreamOrigin("http://127.0.0.1:8000", true));
  assert.equal(
    upstreamOrigin("http://127.0.0.1:8016", false),
    "http://127.0.0.1:8016",
  );
});
test("refresh ignores browser-supplied credentials, rotates cookies, and clears revoked sessions", async () => {
  let sent: unknown;
  const refresh = "synthetic-cookie-refresh-token-1234567890";
  const response = await identityGateway(
    request(
      "auth/refresh",
      "POST",
      { refresh_token: "forged" },
      `${cookie.refresh}=${refresh}`,
    ),
    "auth/refresh",
    async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return json(tokens);
    },
  );
  assert.deepEqual(sent, { refresh_token: refresh });
  assert.equal(response.status, 200);
  const revoked = await identityGateway(
    request("auth/refresh", "POST", {}, `${cookie.refresh}=${refresh}`),
    "auth/refresh",
    async () => json({ detail: "invalid_refresh_token" }, 401),
  );
  assert.equal(revoked.cookies.get(cookie.refresh)?.value, "");
});
test("bearer headers are derived exclusively from server cookies, and validation inputs never leak", async () => {
  let sent: unknown;
  const req = request("auth/me", "GET", {}, `${cookie.access}=trusted-cookie`);
  req.headers.set("Authorization", "Bearer attacker-value");
  const response = await identityGateway(req, "auth/me", async (_url, init) => {
    sent = (init?.headers as Record<string, string>).Authorization;
    return json(
      {
        detail: [
          {
            input: "sensitive-credential",
            msg: "untrusted validation message",
          },
        ],
      },
      422,
    );
  });
  assert.equal(sent, "Bearer trusted-cookie");
  assert.deepEqual(await response.json(), { error: "request_failed" });
});
test("logout clears all credentials and organization selection never exposes JWTs", async () => {
  const session = `${cookie.access}=synthetic-access`;
  const logout = await identityGateway(
    request("auth/logout", "POST", {}, session),
    "auth/logout",
    async () => new Response(null, { status: 204 }),
  );
  assert.equal(logout.status, 204);
  assert.equal(logout.cookies.get(cookie.access)?.value, "");
  const org = "11111111-1111-4111-8111-111111111111";
  const switched = await identityGateway(
    request(
      "auth/switch-organization",
      "POST",
      { organization_id: org },
      session,
    ),
    "auth/switch-organization",
    async () =>
      json({ access_token: tokens.access_token, organization_id: org }),
  );
  assert.deepEqual(await switched.json(), { organization_id: org });
});
test("host-prefixed production cookies are isolated from development cookies", () => {
  assert.match(authCookieNames(true).access, /^__Host-/);
  assert.doesNotMatch(authCookieNames(false).access, /^__Host-/);
});

test("origin validation uses the actual Host authority when Next normalizes localhost", () => {
  const request = new Request("http://localhost:3106/api/v1/auth/login", {
    headers: { host: "127.0.0.1:3106", origin: "http://127.0.0.1:3106" },
  });
  assert.equal(mutationOriginAllowed(request), true);
  request.headers.set("origin", "https://evil.example");
  request.headers.set("x-forwarded-host", "evil.example");
  assert.equal(mutationOriginAllowed(request), false);
});
test("entry serialization retains false and zero, omits optional unknown values, and requires explicit missing-data reasons", () => {
  const section: Section = {
    key: "medical",
    label: "Medical",
    enabled: true,
    identity_roles: ["doctor"],
    role_ids: [],
    fields: [
      {
        key: "zero",
        label: "Score",
        type: "number",
        required: true,
        choices: [],
      },
      {
        key: "answer",
        label: "Answer",
        type: "boolean",
        required: true,
        choices: [],
      },
      {
        key: "note",
        label: "Note",
        type: "text",
        required: false,
        choices: [],
      },
    ],
  };
  const form = new FormData();
  form.set("zero", "0");
  form.set("answer", "false");
  assert.deepEqual(collectEntryValues(section, form), {
    zero: { status: "present", value: 0 },
    answer: { status: "present", value: false },
  });
  form.set("zero__status", "not_assessed");
  assert.throws(() => collectEntryValues(section, form));
  form.set("zero__reason", "Patient unavailable");
  assert.deepEqual(collectEntryValues(section, form).zero, {
    status: "not_assessed",
    reason: "Patient unavailable",
  });
});
test("Zustand identity UI is isolated per provider and resets facility selection", () => {
  const first = createIdentityUI(),
    second = createIdentityUI();
  first.getState().selectOrganization("facility-one");
  assert.equal(second.getState().pendingOrganization, null);
  first.getState().reset();
  assert.equal(first.getState().pendingOrganization, null);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { NextRequest } from "next/server";
import { identityGateway } from "../lib/server/identity-gateway";
import { apiRequest, ApiError } from "../lib/api/client";
import { describeProblem, issueLabel, issueMessage } from "../lib/api/errors";
import { safeValidationIssues } from "../lib/api/problem-contract";
import { authCookieNames } from "../lib/server/auth-cookies";
const reference = "11111111-1111-4111-8111-111111111111";

test("unrelated 422 errors never mention password policy", () => {
  for (const path of [
    "invalid_request",
    "enabled_section_requires_a_responsible_team_role",
    "clinical_capabilities_require_a_clinical_profession",
    "unknown_problem",
  ])
    assert.doesNotMatch(describeProblem(422, path, []), /password/i);
  assert.match(
    describeProblem(
      422,
      "enabled_section_requires_a_responsible_team_role",
      [],
    ),
    /care-team role/,
  );
});
test("safe field metadata crosses the gateway without original values or messages", async () => {
  const req = new NextRequest(
    "https://ccu360.health/api/v1/workforce/departments",
    {
      method: "POST",
      headers: {
        origin: "https://ccu360.health",
        "content-type": "application/json",
        cookie: `${authCookieNames().access}=synthetic-access`,
      },
      body: JSON.stringify({ name: "x", code: "INVALID" }),
    },
  );
  const response = await identityGateway(
    req,
    "workforce/departments",
    async () =>
      Response.json(
        {
          title: "invalid_request",
          errors: [
            {
              path: ["code"],
              code: "invalid_format",
              input: "DO_NOT_ECHO",
              msg: "DO_NOT_ECHO",
              ctx: { secret: "DO_NOT_ECHO" },
            },
            { path: ["PATIENT_SECRET"], code: "required" },
            { path: ["name"], code: "untrusted_code" },
          ],
        },
        { status: 422, headers: { "x-request-id": reference } },
      ),
  );
  const data = await response.json();
  assert.deepEqual(data, {
    error: "invalid_request",
    requestId: reference,
    issues: [{ path: ["code"], code: "invalid_format" }],
  });
  assert.doesNotMatch(JSON.stringify(data), /DO_NOT_ECHO|PATIENT_SECRET/);
});
test("field labels locate publication stages and explain schema bounds", () => {
  const issue = {
    path: ["definition", "stages", 0, "sections", 0, "role_ids"],
    code: "section_team_required",
  } as const;
  const validated = safeValidationIssues([issue])[0];
  assert.match(
    issueLabel(validated),
    /Admission 360.*Section 1.*Responsible care teams/,
  );
  assert.match(issueMessage(validated), /responsible care-team/);
  assert.match(
    issueMessage({ path: ["name"], code: "too_short", params: { min: 2 } }),
    /at least 2 characters/,
  );
  assert.match(
    issueMessage(
      { path: ["code"], code: "invalid_format" },
      "/api/v1/workforce/departments",
    ),
    /lowercase/,
  );
  assert.match(
    issueMessage({
      path: ["radius_meters"],
      code: "minimum",
      params: { min: 25 },
    }),
    /25/,
  );
});
test("API client normalizes network failures, never retries a failed write and marks uncertain outcomes", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      throw new TypeError("Sensitive internal network detail");
    };
    await assert.rejects(
      apiRequest("/api/v1/journey/encounters", z.unknown(), {
        method: "POST",
        body: {},
      }),
      (error) =>
        error instanceof ApiError &&
        error.status === 0 &&
        error.outcomeUnknown &&
        !error.message.includes("Sensitive"),
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("invalid response bodies are safe errors, rate limits retain wait guidance, and aborts remain aborts", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("<html>secret-stack</html>");
    await assert.rejects(
      apiRequest("/api/v1/auth/me", z.unknown()),
      (error) =>
        error instanceof ApiError &&
        error.code === "invalid_response" &&
        !error.message.includes("secret-stack"),
    );
    globalThis.fetch = async () =>
      Response.json(
        { error: "rate_limited", requestId: reference },
        { status: 429, headers: { "retry-after": "90" } },
      );
    await assert.rejects(
      apiRequest("/api/v1/auth/me", z.unknown()),
      (error) =>
        error instanceof ApiError &&
        error.retryAfterSeconds === 90 &&
        /2 minutes/.test(error.message),
    );
    globalThis.fetch = async () => {
      throw new DOMException("cancelled", "AbortError");
    };
    await assert.rejects(
      apiRequest("/api/v1/auth/me", z.unknown()),
      (error) => error instanceof DOMException && error.name === "AbortError",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("malformed error envelopes are masked and schema issue limits are bounded", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json(null, { status: 422 });
    await assert.rejects(
      apiRequest("/api/v1/auth/me", z.unknown()),
      (error) => error instanceof ApiError && !/password/.test(error.message),
    );
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(
    safeValidationIssues(
      Array.from({ length: 100 }, () => ({ path: ["name"], code: "required" })),
    ).length,
    20,
  );
});

test("request deadlines support parent cancellation without modern AbortSignal helpers", async () => {
  const original = globalThis.fetch;
  const any = Object.getOwnPropertyDescriptor(AbortSignal, "any");
  const timeout = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
  try {
    Object.defineProperty(AbortSignal, "any", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(AbortSignal, "timeout", {
      configurable: true,
      value: undefined,
    });
    globalThis.fetch = async (_url, init) => {
      assert.ok(init?.signal instanceof AbortSignal);
      return Response.json({ ok: true });
    };
    assert.deepEqual(
      await apiRequest("/api/v1/auth/me", z.object({ ok: z.boolean() })),
      { ok: true },
    );
    const parent = new AbortController();
    globalThis.fetch = async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      });
    const pending = apiRequest("/api/v1/auth/me", z.unknown(), {
      signal: parent.signal,
    });
    parent.abort();
    await assert.rejects(
      pending,
      (error) => error instanceof DOMException && error.name === "AbortError",
    );
  } finally {
    globalThis.fetch = original;
    if (any) Object.defineProperty(AbortSignal, "any", any);
    if (timeout) Object.defineProperty(AbortSignal, "timeout", timeout);
  }
});

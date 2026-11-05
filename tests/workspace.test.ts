import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/demo/seed";
import { createDemoRepository } from "../lib/demo/repository";
import { transitionAction, workspaceSchema } from "../lib/domain/workspace";
import { createWorkspaceStore } from "../store/workspace-store";
import { ApiError, apiRead } from "../lib/api/client";
import { z } from "zod";

test("action transitions preserve original history, actor, time and increment version", () => {
  const original = structuredClone(seed.actions[0]);
  const next = transitionAction(
    original,
    "in_progress",
    1,
    "Demo nurse",
    "2026-11-05T07:00:00Z",
  );
  assert.equal(next.version, 2);
  assert.equal(next.history.length, original.history.length + 1);
  assert.deepEqual(next.history[0], original.history[0]);
  assert.equal(next.history.at(-1)?.actor, "Demo nurse");
  assert.equal(original.status, "open");
  assert.equal(original.version, 1);
});
test("stale versions and skipped/reversed transitions fail closed", () => {
  const a = seed.actions[0];
  assert.throws(
    () => transitionAction(a, "in_progress", 0, "Demo", "2026-11-05T07:00:00Z"),
    /changed/,
  );
  assert.throws(
    () => transitionAction(a, "completed", 1, "Demo", "2026-11-05T07:00:00Z"),
    /not permitted/,
  );
  const running = transitionAction(
    a,
    "in_progress",
    1,
    "Demo",
    "2026-11-05T07:00:00Z",
  );
  const done = transitionAction(
    running,
    "completed",
    2,
    "Demo",
    "2026-11-05T07:01:00Z",
  );
  assert.throws(
    () => transitionAction(done, "open", 3, "Demo", "2026-11-05T07:02:00Z"),
    /not permitted/,
  );
});
test("demo repositories and returned snapshots are isolated", () => {
  const first = createDemoRepository();
  const second = createDemoRepository();
  first.transition("act-1", "in_progress", 1);
  assert.equal(second.read().actions[0].status, "open");
  const snapshot = first.read();
  snapshot.patients[0].name = "changed";
  assert.equal(first.read().patients[0].name, seed.patients[0].name);
  assert.throws(
    () => first.transition("missing", "in_progress", 1),
    /not found/,
  );
});
test("UI stores do not leak selections between provider instances", () => {
  const a = createWorkspaceStore(),
    b = createWorkspaceStore();
  a.getState().setUnit("HDU");
  assert.equal(b.getState().unit, "All units");
});
test("schema retains unavailable, conflict and unverified source states", () => {
  const parsed = workspaceSchema.parse(seed);
  const states = new Set(
    parsed.patients.flatMap((p) => p.observations.map((o) => o.state)),
  );
  for (const state of [
    "verified",
    "unverified",
    "stale",
    "missing",
    "conflict",
  ])
    assert.ok(states.has(state as never));
  assert.equal(parsed.patients[3].observations[0].value, "—");
});
test("API client refuses non API paths, masks response bodies and rejects malformed responses", async () => {
  const originalFetch = globalThis.fetch;
  try {
    await assert.rejects(
      apiRead("https://outside.example/patients", z.object({ id: z.string() })),
      /Invalid API path/,
    );
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ sensitive: "Do not expose" }), {
        status: 403,
      });
    await assert.rejects(
      apiRead("/api/v1/workspace", z.object({ id: z.string() })),
      (error) =>
        error instanceof ApiError &&
        error.status === 403 &&
        !error.message.includes("sensitive"),
    );
    globalThis.fetch = async () => Response.json({ id: 42 });
    await assert.rejects(
      apiRead("/api/v1/workspace", z.object({ id: z.string() })),
      /could not be verified/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

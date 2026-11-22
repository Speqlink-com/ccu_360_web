import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";

const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["scripts/start.mjs"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port) },
});
let startup = "";
server.stdout.on("data", (value) => {
  startup = (startup + value).slice(-4000);
});
server.stderr.on("data", (value) => {
  startup = (startup + value).slice(-4000);
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for the owned server only. */
    }
    if (server.exitCode !== null)
      throw new Error(`Server exited before readiness: ${startup}`);
    await setTimeout(250);
  }
  assert.ok(ready, "Production server did not become ready");
  for (const path of ["/", "/auth/signin", "/dashboard", "/dashboard/actions", "/dashboard/connect", "/dashboard/worksite"]) {
    const response = await fetch(base + path, {
      signal: AbortSignal.timeout(5000),
      redirect: "manual",
    });
    assert.equal(response.status, path === "/" || path.startsWith("/dashboard") ? 307 : 200);
    const html = await response.text();
    assert.ok(
      !html.includes("Explore the demo workspace"),
      "Production must not expose the demo entry",
    );
    assert.ok(
      !html.includes("Alex Morgan"),
      "Production must not render synthetic patient records",
    );
    if (path === "/" || path.startsWith("/dashboard"))
      assert.equal(
        new URL(response.headers.get("location"), base).pathname,
        "/auth/signin",
        "Index and unauthenticated clinical routes redirect to sign-in",
      );
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.match(response.headers.get("permissions-policy") ?? "", /geolocation=\(self\)/);
    if (path === "/auth/signin") {
      const stylesheet = html.match(/href="([^"]+\.css(?:\?[^"]*)?)"/);
      assert.ok(stylesheet, "A production stylesheet must be present");
      assert.equal(
        (await fetch(new URL(stylesheet[1].replaceAll("&amp;", "&"), base)))
          .status,
        200,
      );
    }
    console.log(`PASS ${path}: production boundary and security headers`);
  }
  for (const resource of [
    "session",
    "directory",
    "workspace",
    "facilities",
    "employees",
  ]) {
    const response = await fetch(base + "/api/demo/" + resource);
    assert.equal(
      response.status,
      404,
      "Demo endpoints must be disabled in production",
    );
  }
  console.log(
    "PASS demonstration accounts/endpoints are disabled in production",
  );
  const session = await fetch(base + "/api/v1/auth/me");
  assert.equal(session.status, 401);
  assert.match(session.headers.get("cache-control"), /no-store/);
  const csrf = await fetch(base + "/api/v1/auth/login", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(csrf.status, 403);
  console.log(
    "PASS production identity boundaries: HttpOnly session required and cross-origin mutations rejected",
  );
  const logo = await fetch(base + "/ccu360-logo.png");
  assert.equal(logo.status, 200);
  assert.ok(logo.headers.get("content-type")?.startsWith("image/png"));
  console.log("PASS standalone CSS and logo assets");
} finally {
  server.kill("SIGTERM");
}

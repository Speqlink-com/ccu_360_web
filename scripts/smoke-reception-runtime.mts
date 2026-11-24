/** Reception regression with production DB privileges and a deliberately lost successful response. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { chromium, expect as baseExpect, type Page } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 60_000 });
const root = process.cwd();
const backend =
  process.env.CCU360_BACKEND_PATH ?? resolve(root, "../ccu_360_infra");
const python = resolve(backend, ".venv/bin/python");
const contextFile = resolve(
  tmpdir(),
  `ccu360-intake-${randomBytes(8).toString("hex")}.json`,
);
const buildDir = `.next-integration-${randomBytes(4).toString("hex")}`;
const originalTsconfig = readFileSync("tsconfig.json", "utf8");
const children: ReturnType<typeof spawn>[] = [];
const logs: string[] = [];
let prepared = false;
let activePage: Page | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
function fixture(mode: string) {
  execFileSync(
    python,
    ["-m", "scripts.web_e2e_fixture", mode, "--context", contextFile],
    {
      cwd: backend,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}
async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}
function start(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  const capture = (data: Buffer) => {
    logs.push(String(data));
    if (logs.length > 300) logs.shift();
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
}
async function ready(url: string) {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {
      /* Owned test servers only. */
    }
    await setTimeout(500);
  }
  throw new Error("Owned reception test server failed readiness");
}
async function login(page: Page, base: string, email: string) {
  await page.goto(base + "/auth/signin");
  await page.getByLabel("Work email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic!ClinicalA9River2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Choose your facility", exact: true })
    .waitFor();
  await page.getByLabel("Facility", { exact: true }).selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Open workspace", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Workspace snapshot", exact: true })
    .waitFor();
}
try {
  fixture("prepare");
  prepared = true;
  console.log("Disposable fixture prepared; email disabled.");
  const fixtureEnv = JSON.parse(readFileSync(contextFile, "utf8"));
  const runtimeUrl = new URL(fixtureEnv.CCU360_E2E_RUNTIME_DATABASE_URL);
  const ownerUrl = new URL(fixtureEnv.DATABASE_URL);
  assert.match(runtimeUrl.pathname, /^\/ccu360_web_[a-f0-9]{12}_test$/);
  assert.ok(["localhost", "127.0.0.1", "db"].includes(runtimeUrl.hostname));
  assert.notEqual(runtimeUrl.username, ownerUrl.username);
  const api = `http://127.0.0.1:${await freePort()}`;
  const base = `http://127.0.0.1:${await freePort()}`;
  const env = {
    ...process.env,
    ...fixtureEnv,
    DATABASE_URL: fixtureEnv.CCU360_E2E_RUNTIME_DATABASE_URL,
    FRONTEND_URL: base,
    CORS_ORIGINS: JSON.stringify([base]),
  };
  start(
    python,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      new URL(api).port,
      "--no-access-log",
    ],
    backend,
    env,
  );
  await ready(api + "/health/ready");
  console.log("Restricted-role API ready.");
  start(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      new URL(base).port,
    ],
    root,
    {
      ...process.env,
      NEXT_PUBLIC_DEMO_MODE: "false",
      API_PROXY_TARGET: api,
      CCU360_BUILD_DIR: buildDir,
      NEXT_TELEMETRY_DISABLED: "1",
      WATCHPACK_POLLING: "true",
    },
  );
  await ready(base + "/auth/signin");
  console.log("Current web sign-in ready.");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const receptionistContext = await browser.newContext();
  const page = await receptionistContext.newPage();
  activePage = page;
  page.setDefaultTimeout(180_000);
  page.setDefaultNavigationTimeout(180_000);
  await login(page, base, "receptionist-e2e@example.org");
  const created = await page.request.post(
    base + "/api/v1/journey/reception/patients",
    {
      headers: { Origin: base },
      data: {
        client_id: randomUUID(),
        ip_number: "INTAKE-RUNTIME-001",
        display_name: "Synthetic Runtime Intake Patient",
        date_of_birth: "1990-05-20",
        sex: "female",
        phone: null,
      },
    },
  );
  expect(created.status()).toBe(201);
  await page.goto(base + "/dashboard/patients");
  const row = page
    .locator("tbody tr")
    .filter({ hasText: "Synthetic Runtime Intake Patient" });
  await row.getByRole("button", { name: "Open patient", exact: true }).click();
  await page
    .getByRole("button", { name: "Record arrival & continue", exact: true })
    .click();
  const recorded = page.getByRole("region", {
    name: "Recorded arrival",
    exact: true,
  });
  await recorded
    .getByRole("heading", { name: "Arrival recorded", exact: true })
    .waitFor();
  await recorded.getByText("Start a journey form", { exact: true }).click();
  await recorded
    .getByRole("combobox", { name: "Published form", exact: true })
    .click();
  await recorded
    .getByRole("option", {
      name: "Standard clinical journey · v1",
      exact: true,
    })
    .click();
  let submitted: unknown;
  let encounterId = "";
  let attempts = 0;
  await page.route(
    "**/api/v1/journey/reception/arrivals/*/forms",
    async (route) => {
      attempts += 1;
      const body = route.request().postDataJSON();
      if (attempts === 1) {
        submitted = body;
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        const saved = await response.json();
        expect(saved.visit.journeys).toHaveLength(1);
        encounterId = saved.visit.journeys[0].id;
        // The server committed. Simulate an intermediary losing that success response.
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "service_unavailable",
            requestId: randomUUID(),
          }),
        });
      } else {
        assert.deepEqual(body, submitted);
        await route.continue();
      }
    },
  );
  await recorded
    .getByRole("button", { name: "Start form for this arrival", exact: true })
    .click();
  await recorded.getByText(/Your change may have been saved/).waitFor();
  await expect(
    recorded.getByRole("combobox", { name: "Published form", exact: true }),
  ).toBeDisabled();
  await recorded
    .getByRole("button", { name: "Check / retry same form", exact: true })
    .click();
  await expect(recorded).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clinical journey history", exact: true })
    .click();
  const open = page.getByRole("link", { name: "Open ledger", exact: true });
  await expect(open).toHaveCount(1);
  await expect(open).toHaveAttribute(
    "href",
    "/dashboard/patients/" + encounterId,
  );
  await expect(
    page.getByText("1 recorded arrival", { exact: false }),
  ).toBeVisible();
  await open.click();
  await page.waitForURL(base + "/dashboard/patients/" + encounterId, {
    timeout: 180_000,
  });
  await page
    .getByRole("heading", {
      name: "Synthetic Runtime Intake Patient",
      exact: true,
    })
    .waitFor();
  await expect(
    page.getByRole("region", {
      name: "Complete shared patient ledger",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(attempts, 2);
  console.log(
    "PASS restricted production DB role: record arrival, attach published form, recover lost response using identical request, one arrival and one ledger",
  );
  const nurseContext = await browser.newContext();
  const nurse = await nurseContext.newPage();
  activePage = nurse;
  nurse.setDefaultTimeout(120_000);
  nurse.setDefaultNavigationTimeout(120_000);
  await login(nurse, base, "nurse-e2e@example.org");
  await nurse.goto(base + "/dashboard/patients/" + encounterId);
  await nurse
    .getByRole("heading", {
      name: "Synthetic Runtime Intake Patient",
      exact: true,
    })
    .waitFor();
  const ledger = nurse.getByRole("region", {
    name: "Complete shared patient ledger",
    exact: true,
  });
  await expect(
    ledger.getByRole("button", { name: "Complete section", exact: true }),
  ).toHaveCount(1);
  await nurse.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      nurse.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await nurse.screenshot({
    path: "/tmp/ccu360-intake-runtime-mobile.png",
    fullPage: true,
  });
  console.log(
    "PASS shared nurse role opens reception-started ledger; only nursing is writable; mobile layout fits",
  );
} catch (error) {
  await activePage
    ?.screenshot({
      path: "/tmp/ccu360-intake-runtime-failure.png",
      fullPage: true,
    })
    .catch(() => {});
  // Test server logs contain only synthetic fixture traffic; never print dotenv content or tokens.
  console.error(logs.join("").slice(-3500));
  throw error;
} finally {
  await browser?.close();
  for (const child of children) child.kill("SIGTERM");
  for (const child of children)
    if (child.exitCode === null)
      await Promise.race([
        new Promise((done) => child.once("exit", done)),
        setTimeout(5000),
      ]);
  if (children.some((child) => child.exitCode === null))
    for (const child of children)
      if (child.exitCode === null) child.kill("SIGKILL");
  if (prepared || existsSync(contextFile)) fixture("cleanup");
  const config = JSON.parse(readFileSync("tsconfig.json", "utf8"));
  config.include = config.include.filter(
    (item: string) => !item.startsWith(buildDir + "/"),
  );
  if (JSON.stringify(config) === JSON.stringify(JSON.parse(originalTsconfig)))
    writeFileSync("tsconfig.json", originalTsconfig);
  else writeFileSync("tsconfig.json", JSON.stringify(config, null, 2) + "\n");
  rmSync(resolve(root, buildDir), { recursive: true, force: true });
}

/** Real browser + FastAPI integration. All accounts and records live in an owned disposable database. */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { chromium, type Page } from "@playwright/test";

const root = process.cwd(),
  backend =
    process.env.CCU360_BACKEND_PATH ?? resolve(root, "../ccu_360_infra");
const python = resolve(backend, ".venv/bin/python");
const contextFile = resolve(
  tmpdir(),
  "ccu360-web-e2e-" + randomBytes(8).toString("hex") + ".json",
);
const buildDir = ".next-integration-" + randomBytes(4).toString("hex");
const processes: ReturnType<typeof spawn>[] = [];
const log: string[] = [];
async function port() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const value = (server.address() as { port: number }).port;
  await new Promise<void>((done) => server.close(() => done()));
  return value;
}
function fixture(mode: string, email?: string) {
  return execFileSync(
    python,
    [
      "-m",
      "scripts.web_e2e_fixture",
      mode,
      "--context",
      contextFile,
      ...(email ? ["--email", email] : []),
    ],
    { cwd: backend, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
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
  processes.push(child);
  child.stdout?.on("data", (data) => {
    log.push(String(data));
    if (log.length > 30) log.shift();
  });
  child.stderr?.on("data", (data) => {
    log.push(String(data));
    if (log.length > 30) log.shift();
  });
  return child;
}
async function ready(url: string) {
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {
      /* Wait for only the owned processes. */
    }
    await setTimeout(400);
  }
  throw new Error("Owned integration server did not become ready");
}
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret)
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = Buffer.from(
    bits.match(/.{8}/g)!.map((value) => parseInt(value, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", bytes).update(counter).digest();
  const offset = hash.at(-1)! & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
function panel(page: Page, title: string) {
  return page
    .locator("section.live-panel")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}
async function signIn(
  page: Page,
  base: string,
  email: string,
  password: string,
) {
  await page.goto(base);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function enroll(page: Page) {
  await page
    .getByRole("button", { name: "Set up authenticator", exact: true })
    .click();
  const secret = (await page.locator(".setup-key").textContent())!;
  await page.getByLabel("Six-digit authenticator code").fill(totp(secret));
  await page
    .getByRole("button", { name: "Enable two-step verification" })
    .click();
  await page.getByText("I have saved my recovery codes.").check();
  await page.getByRole("button", { name: "Continue to workspace" }).click();
  await page
    .getByRole("heading", { name: /^Welcome,|^Choose your facility$/ })
    .waitFor();
}
async function chooseFacility(page: Page) {
  await page
    .getByRole("heading", { name: "Choose your facility", exact: true })
    .waitFor();
  await page.getByLabel("Facility", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Open facility workspace" }).click();
  await page.getByRole("heading", { name: /^Welcome,/ }).waitFor();
}
const ownerPassword = "Synthetic!OwnerA9River2026",
  clinicianPassword = "Synthetic!ClinicalA9River2026",
  invitedPassword = "Synthetic!InvitedA9River2026";
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let activePage: Page | undefined;
try {
  fixture("prepare");
  console.log("Fixture ready");
  const env = JSON.parse(readFileSync(contextFile, "utf8"));
  assert.match(
    new URL(env.DATABASE_URL).pathname,
    /ccu360_web_[a-f0-9]{12}_test$/,
  );
  const apiPort = await port(),
    webPort = await port();
  const api = `http://127.0.0.1:${apiPort}`,
    base = `http://127.0.0.1:${webPort}`;
  start(
    python,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(apiPort),
      "--no-access-log",
    ],
    backend,
    { ...process.env, ...env },
  );
  await ready(api + "/health/ready");
  console.log("Isolated API ready");
  start(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(webPort),
    ],
    root,
    {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_DEMO_MODE: "false",
      API_PROXY_TARGET: api,
      CCU360_BUILD_DIR: buildDir,
      NEXT_TELEMETRY_DISABLED: "1",
      WATCHPACK_POLLING: "true",
    },
  );
  await ready(base);
  console.log("Isolated web ready");
  browser = await chromium.launch({ headless: true });
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  activePage = owner;
  owner.setDefaultTimeout(30_000);
  await signIn(owner, base, "ahs-e2e@example.org", ownerPassword);
  await enroll(owner);
  assert.ok(
    (await ownerContext.cookies())
      .filter((cookie) => cookie.name.startsWith("ccu-"))
      .every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax"),
  );
  await owner.goto(base + "/dashboard/facilities");
  const onboarding = panel(owner, "Onboard a facility");
  await onboarding
    .getByLabel("Facility name", { exact: true })
    .fill("Synthetic New Facility");
  await onboarding.getByLabel("Unique facility code").fill("E2E_NEW");
  await onboarding
    .getByLabel("Administrator’s full name")
    .fill("Synthetic Facility Owner");
  await onboarding
    .getByLabel("Administrator’s email")
    .fill("facility-e2e@example.org");
  await onboarding
    .getByRole("button", { name: "Create facility & send invitation" })
    .click();
  await owner
    .getByText(
      "Facility created. The administrator’s invitation is queued for delivery.",
    )
    .waitFor();
  await owner.goto(base + "/dashboard/administrators");
  const adminForm = panel(owner, "Invite an AHS administrator");
  await adminForm
    .getByLabel("Full name")
    .fill("Synthetic Second Administrator");
  await adminForm
    .getByLabel("Email", { exact: true })
    .fill("second-ahs-e2e@example.org");
  await adminForm
    .getByRole("button", { name: "Send administrator invitation" })
    .click();
  await adminForm.getByText("Administrator invitation queued.").waitFor();
  console.log(
    "PASS first AHS password, QR/TOTP enrollment, HttpOnly session, facility onboarding and administrator invitation",
  );
  const invitedContext = await browser.newContext();
  const invited = await invitedContext.newPage();
  activePage = invited;
  invited.setDefaultTimeout(30_000);
  const token = fixture("invitation", "facility-e2e@example.org");
  await invited.goto(base + "/auth/accept-invite#token=" + token);
  await invited
    .getByLabel("Password (12–128 characters)", { exact: true })
    .fill(invitedPassword);
  await invited.getByLabel("Confirm password").fill(invitedPassword);
  await invited.getByRole("button", { name: "Accept invitation" }).click();
  await invited.getByRole("heading", { name: "You’re all set." }).waitFor();
  assert.equal(new URL(invited.url()).hash, "");
  await signIn(invited, base, "facility-e2e@example.org", invitedPassword);
  await enroll(invited);
  if (
    await invited
      .getByRole("heading", { name: "Choose your facility", exact: true })
      .isVisible()
  )
    await chooseFacility(invited);
  await invited.goto(base + "/dashboard/employees");
  const employeeForm = panel(invited, "Invite an employee");
  await employeeForm.getByLabel("Full name").fill("Synthetic New Employee");
  await employeeForm
    .getByLabel("Email", { exact: true })
    .fill("employee-e2e@example.org");
  await employeeForm
    .getByRole("button", { name: "Send employee invitation" })
    .click();
  await employeeForm.getByText(/Employee invitation queued/).waitFor();
  await invited.goto(base + "/dashboard/workforce");
  const departments = panel(invited, "Departments");
  await departments.getByText("Add a department", { exact: true }).click();
  await departments.getByLabel("Department name").fill("Critical Care");
  await departments
    .getByLabel("Code (lowercase, numbers, underscores)")
    .fill("critical_care");
  await departments.getByRole("button", { name: "Create department" }).click();
  await departments.getByText("Saved successfully.").waitFor();
  console.log(
    "PASS provider invitation acceptance, mandatory MFA, tenant selection, employee invitation and department creation",
  );
  const clinicalContext = await browser.newContext();
  const clinical = await clinicalContext.newPage();
  activePage = clinical;
  clinical.setDefaultTimeout(30_000);
  await signIn(clinical, base, "clinician-e2e@example.org", clinicianPassword);
  await chooseFacility(clinical);
  await clinical.goto(base + "/dashboard/patients");
  const registry = panel(clinical, "Find or register a patient");
  await registry
    .getByRole("button", { name: "Register a new patient" })
    .click();
  const registration = registry.locator("form").last();
  await registration
    .getByLabel("Patient identifier / MRN")
    .fill("SYNTHETIC-E2E-001");
  await registration
    .getByLabel("Patient name")
    .fill("Synthetic Browser Patient");
  await registration
    .getByRole("button", { name: "Register patient", exact: true })
    .click();
  await registry
    .getByText("Synthetic Browser Patient", { exact: true })
    .waitFor();
  const admission = panel(clinical, "Open a patient journey");
  await admission
    .getByLabel("Journey form", { exact: true })
    .selectOption({ index: 1 });
  await admission.getByLabel("Unit", { exact: true }).fill("ICU");
  await admission.getByLabel("Bed (optional)", { exact: true }).fill("B01");
  await admission
    .getByLabel("Admission date & time (local time)")
    .fill("2026-11-12T14:00");
  await admission.getByLabel("Medical on-duty team", { exact: true }).check();
  await admission
    .getByRole("button", { name: "Open journey", exact: true })
    .click();
  await clinical
    .getByRole("heading", { name: "Synthetic Browser Patient", exact: true })
    .waitFor();
  await clinical
    .getByLabel(/Professional note/)
    .fill("Synthetic browser clinical note for integration verification.");
  await clinical
    .getByRole("button", { name: "Save draft note", exact: true })
    .click();
  const note = clinical.locator("article.record-card").filter({
    hasText: "Synthetic browser clinical note for integration verification.",
  });
  await note.waitFor();
  await note.getByText("Attest this draft", { exact: true }).click();
  await note.getByLabel("Re-enter your password").fill(clinicianPassword);
  await note.getByRole("checkbox").check();
  await note
    .getByRole("button", { name: "Attest clinical note", exact: true })
    .click();
  await clinical
    .locator("article.record-card")
    .filter({ hasText: "attested" })
    .waitFor();
  await clinical
    .getByRole("button", {
      name: "I have reviewed the latest version",
      exact: true,
    })
    .click();
  await clinical.getByLabel("Documentation type").selectOption("comment");
  await clinical
    .getByLabel("Comment", { exact: true })
    .fill("Synthetic professional comment with attribution.");
  await clinical
    .getByRole("button", { name: "Post comment", exact: true })
    .click();
  await clinical
    .getByText("Synthetic professional comment with attribution.", {
      exact: true,
    })
    .waitFor();
  await clinical.getByRole("tab", { name: "Team actions" }).click();
  const action = panel(clinical, "Create a team action");
  await action
    .getByLabel("Action", { exact: true })
    .fill("Synthetic browser follow-up action");
  await action
    .getByLabel("Responsible team", { exact: true })
    .selectOption({ index: 1 });
  await action
    .getByRole("button", { name: "Create action", exact: true })
    .click();
  const recordedAction = clinical
    .locator("article.record-card")
    .filter({ hasText: "Synthetic browser follow-up action" });
  await recordedAction
    .getByLabel("Next status", { exact: true })
    .selectOption("completed");
  await recordedAction
    .getByLabel("Update / reason", { exact: true })
    .fill("Synthetic action completed for verification");
  await recordedAction
    .getByRole("button", { name: "Record action update", exact: true })
    .click();
  await recordedAction.getByText("completed", { exact: true }).waitFor();
  await clinical.getByRole("tab", { name: "Shared observations" }).click();
  const observationForm = panel(clinical, "Record an observation");
  await observationForm
    .getByLabel("Observation name / code", { exact: true })
    .fill("SpO2");
  await observationForm
    .getByLabel("Measured value", { exact: true })
    .fill("98");
  await observationForm
    .getByLabel("Unit (optional)", { exact: true })
    .fill("%");
  await observationForm
    .getByLabel("Acting team role", { exact: true })
    .selectOption({ index: 1 });
  await observationForm
    .getByRole("button", { name: "Record observation", exact: true })
    .click();
  await clinical.getByText("SpO2: 98 %", { exact: true }).waitFor();
  await clinical.getByRole("tab", { name: "Audit & evidence" }).click();
  await clinical
    .getByRole("button", { name: "Verify ledger integrity" })
    .click();
  await clinical.getByText(/Integrity verified/).waitFor();
  await clinical.screenshot({
    path: "/tmp/ccu360-web-clinical-desktop.png",
    fullPage: true,
  });
  console.log(
    "PASS real patient registration, assigned journey, draft note, password attestation, comment and ledger integrity",
  );
  await clinicalContext.clearCookies({ name: "ccu-access" });
  const secondTab = await clinicalContext.newPage();
  secondTab.setDefaultTimeout(30_000);
  await Promise.all([
    clinical.goto(base + "/dashboard"),
    secondTab.goto(base + "/dashboard"),
  ]);
  await Promise.all([
    clinical.getByRole("heading", { name: /^Welcome,/ }).waitFor(),
    secondTab.getByRole("heading", { name: /^Welcome,/ }).waitFor(),
  ]);
  assert.ok(
    (await clinicalContext.cookies()).some(
      (cookie) => cookie.name === "ccu-access",
    ),
  );
  await clinical.goto(base + "/dashboard/facilities");
  await clinical
    .getByRole("heading", { name: "This area requires a different role." })
    .waitFor();
  await clinical.getByRole("button", { name: "Sign out", exact: true }).click();
  await clinical.getByRole("heading", { name: "Welcome back." }).waitFor();
  await secondTab.getByRole("heading", { name: "Welcome back." }).waitFor();
  assert.equal(
    await clinical.evaluate(
      () =>
        Object.keys(localStorage).length + Object.keys(sessionStorage).length,
    ),
    0,
  );
  console.log(
    "PASS concurrent cross-tab refresh, role boundary, cross-tab logout and no browser-storage credentials/PHI",
  );
  await owner.screenshot({
    path: "/tmp/ccu360-web-identity-desktop.png",
    fullPage: true,
  });
  await invited.setViewportSize({ width: 390, height: 844 });
  await invited.screenshot({
    path: "/tmp/ccu360-web-identity-mobile.png",
    fullPage: true,
  });
  console.log(
    "PASS browser integration. No real email, production database or production account was used.",
  );
} catch (error) {
  if (activePage) {
    console.error(
      await activePage
        .locator(".inline-error")
        .allTextContents()
        .catch(() => []),
    );
    await activePage
      .screenshot({
        path: "/tmp/ccu360-web-integration-failure.png",
        fullPage: true,
      })
      .catch(() => {});
  }
  console.error(
    error instanceof Error ? error.message : "Integration verification failed",
  );
  console.error(log.slice(-12).join(""));
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const child of processes.reverse()) child.kill("SIGTERM");
  await setTimeout(1000);
  if (existsSync(contextFile)) {
    try {
      fixture("cleanup");
    } catch {
      console.error(
        "Owned test database cleanup needs attention; context file retained at " +
          contextFile,
      );
      process.exitCode = 1;
    }
  }
}

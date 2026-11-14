import assert from "node:assert/strict";
import { expect, type Browser, type Page } from "@playwright/test";

// Called only by smoke-identity, which owns a disposable local database and API.
export async function checkWorksiteCommunication({
  browser,
  admin,
  base,
  invitation,
  password,
}: {
  browser: Browser;
  admin: Page;
  base: string;
  invitation: () => string;
  password: string;
}) {
  await admin.goto(base + "/dashboard/worksite");
  await admin
    .getByRole("button", { name: "Add facility site", exact: true })
    .click();
  const site = admin.getByRole("dialog");
  await site
    .getByLabel("Site name", { exact: true })
    .fill("Synthetic Riverside Campus");
  await site.getByLabel("Latitude", { exact: true }).fill("-1.264");
  await site.getByLabel("Longitude", { exact: true }).fill("36.8");
  await site
    .getByLabel("Boundary radius (metres)", { exact: true })
    .fill("250");
  await site.getByRole("button", { name: "Add site", exact: true }).click();
  await expect(site).not.toBeVisible();
  await admin
    .getByText("Synthetic Riverside Campus", { exact: true })
    .waitFor();
  await admin
    .getByLabel("Connection name", { exact: true })
    .fill("Synthetic facility WAN");
  await admin
    .getByLabel("Public WAN address / CIDR", { exact: true })
    .fill("8.8.8.8/32");
  await admin
    .getByRole("button", { name: "Register connection", exact: true })
    .click();
  await admin.getByText("Synthetic facility WAN", { exact: true }).waitFor();
  const policy = admin.locator("section.live-panel").filter({
    has: admin.getByRole("heading", {
      name: "Employee location policy",
      exact: true,
    }),
  });
  await policy
    .getByLabel("Employee location checks", { exact: true })
    .selectOption("true");
  await policy
    .getByLabel("Reason for this change", { exact: true })
    .fill("Synthetic integration verification");
  await policy
    .getByRole("button", { name: "Save access policy", exact: true })
    .click();
  await policy
    .getByText("Facility access policy updated.", { exact: true })
    .waitFor();
  await admin.evaluate(() => window.scrollTo(0, 0));
  await admin.screenshot({
    path: "/tmp/ccu360-web-worksite-desktop.png",
    fullPage: true,
  });

  const context = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: { latitude: -1.264, longitude: 36.8, accuracy: 10 },
  });
  try {
    const employee = await context.newPage();
    employee.setDefaultTimeout(30000);
    let delivered = false;
    employee.on("websocket", (socket) =>
      socket.on("framereceived", (frame) => {
        try {
          const data = JSON.parse(String(frame.payload));
          if (
            data.type === "events" &&
            data.items.some(
              (item: { kind: string }) => item.kind === "message.created",
            )
          )
            delivered = true;
        } catch {
          /* Only inspect synthetic event metadata. */
        }
      }),
    );
    await employee.goto(base + "/auth/accept-invite#token=" + invitation());
    await employee
      .getByLabel("Password (12–128 characters)", { exact: true })
      .fill(password);
    await employee
      .getByLabel("Confirm password", { exact: true })
      .fill(password);
    await employee
      .getByRole("button", { name: "Accept invitation", exact: true })
      .click();
    await employee.getByRole("heading", { name: "You’re all set." }).waitFor();
    await employee.goto(base);
    await employee
      .getByLabel("Work email", { exact: true })
      .fill("employee-e2e@example.org");
    await employee.getByLabel("Password", { exact: true }).fill(password);
    await employee
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await employee
      .getByRole("heading", { name: "Choose your facility", exact: true })
      .waitFor();
    await employee
      .getByLabel("Facility", { exact: true })
      .selectOption({ index: 1 });
    await employee
      .getByRole("button", { name: "Open facility workspace", exact: true })
      .click();
    await employee
      .getByRole("heading", { name: "Be present. Stay connected." })
      .waitFor();
    assert.equal(
      await employee.evaluate(
        async () => (await fetch("/api/v1/communication/conversations")).status,
      ),
      403,
    );
    await context.setGeolocation({
      latitude: -1.264,
      longitude: 36.8,
      accuracy: 10,
    });
    await employee
      .getByRole("button", { name: "Verify my location", exact: true })
      .click();
    await employee.getByRole("heading", { name: /^Welcome,/ }).waitFor();
    await employee.goto(base + "/dashboard/connect");
    await employee.getByText("Live connection", { exact: true }).waitFor();
    await admin.goto(base + "/dashboard/connect");
    await admin.getByText("Live connection", { exact: true }).waitFor();
    await admin
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    const newConversation = admin.getByRole("dialog");
    await newConversation
      .getByRole("button", { name: "Group conversation", exact: true })
      .click();
    await newConversation
      .getByLabel("Group name", { exact: true })
      .fill("Synthetic ward coordination");
    await newConversation.getByLabel(/Synthetic New Employee/).check();
    await newConversation
      .getByRole("button", { name: "Open conversation", exact: true })
      .click();
    await admin
      .getByLabel("Message this conversation", { exact: true })
      .fill("Synthetic shift coordination message.");
    await admin
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await admin
      .getByText("Synthetic shift coordination message.", { exact: true })
      .waitFor();
    await employee
      .locator(".conversation-row")
      .filter({ hasText: "Synthetic ward coordination" })
      .click();
    await employee
      .getByText("Synthetic shift coordination message.", { exact: true })
      .waitFor();
    await employee.bringToFront();
    await employee
      .getByLabel("Message this conversation", { exact: true })
      .fill("Synthetic acknowledgement from an employee.");
    await employee
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await admin
      .getByText("Synthetic acknowledgement from an employee.", { exact: true })
      .waitFor();
    await expect.poll(() => delivered, { timeout: 15000 }).toBe(true);
    const original = admin
      .locator("article.chat-message")
      .filter({ hasText: "Synthetic shift coordination message." });
    await original.getByRole("button", { name: "Edit", exact: true }).click();
    const edit = admin.getByRole("dialog");
    await edit
      .getByLabel("Message", { exact: true })
      .fill("Synthetic corrected coordination message.");
    await edit
      .getByLabel("Reason for this change", { exact: true })
      .fill("Correct synthetic wording");
    await edit
      .getByRole("button", { name: "Save revision", exact: true })
      .click();
    await employee
      .getByText("Synthetic corrected coordination message.", { exact: true })
      .waitFor();
    await admin.evaluate(() => window.scrollTo(0, 0));
    await admin.screenshot({
      path: "/tmp/ccu360-web-connect-desktop.png",
      fullPage: true,
    });
    await employee.setViewportSize({ width: 390, height: 844 });
    await employee.evaluate(() => window.scrollTo(0, 0));
    await employee.screenshot({
      path: "/tmp/ccu360-web-connect-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await employee.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await admin
      .locator("article.chat-message")
      .filter({ hasText: "Synthetic corrected coordination message." })
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    const redact = admin.getByRole("dialog");
    await redact
      .getByLabel("Reason for this change", { exact: true })
      .fill("Synthetic redaction verification");
    await redact
      .getByRole("button", { name: "Remove message", exact: true })
      .click();
    await employee
      .getByText("Message removed · revision record retained", { exact: true })
      .waitFor();
    await expect(
      employee.getByText("Synthetic corrected coordination message.", {
        exact: true,
      }),
    ).not.toBeVisible();
    await admin
      .getByRole("button", { name: "Participants", exact: true })
      .click();
    const people = admin.getByRole("dialog");
    await people
      .locator("article.participant-item")
      .filter({ hasText: "Synthetic New Employee" })
      .getByRole("button", { name: "Manage", exact: true })
      .click();
    await people
      .getByLabel("Participation", { exact: true })
      .selectOption("false");
    await people
      .getByLabel("Reason", { exact: true })
      .fill("Synthetic participant revocation");
    await people
      .getByRole("button", { name: "Save participant", exact: true })
      .click();
    await expect(
      employee.getByLabel("Message this conversation", { exact: true }),
    ).not.toBeVisible({ timeout: 20000 });
    await people.getByRole("button", { name: "Close dialog" }).click();
    await employee.goto(base + "/dashboard");
    await context.setGeolocation({
      latitude: -2,
      longitude: 36.8,
      accuracy: 10,
    });
    await employee
      .getByRole("button", { name: "Update location", exact: true })
      .click();
    await employee
      .getByRole("heading", { name: "Be present. Stay connected." })
      .waitFor();
    await employee
      .getByRole("link", { name: "My account & security", exact: true })
      .click();
    await employee
      .getByRole("heading", { name: "My account & security", exact: true })
      .waitFor();
    assert.equal(
      await employee.evaluate(
        () =>
          Object.keys(localStorage).length + Object.keys(sessionStorage).length,
      ),
      0,
    );
    await admin.goto(base + "/dashboard/worksite");
    await admin
      .getByRole("heading", { name: "Facility access", exact: true })
      .waitFor();
    console.log(
      "PASS employee geofence recovery/denial, any-internet access, remote admin, registered networks, live WS events, group messaging, editing/redaction, participant revocation, mobile layout and transient storage",
    );
  } finally {
    await context.close();
  }
}

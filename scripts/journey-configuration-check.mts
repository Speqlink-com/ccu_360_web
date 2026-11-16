/** Provider CRUD against real FastAPI, in the smoke runner's disposable tenant. */
import { expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
export async function checkJourneyConfiguration(page: Page, base: string) {
  const panel = (title: string) =>
    page
      .locator("section.live-panel")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  const department = panel("Departments")
    .locator(".live-list-row")
    .filter({ hasText: "Critical Care" });
  await department.getByText("Edit department", { exact: true }).click();
  const edit = department.locator("form").first();
  await edit.getByLabel("Department name").fill("Intensive Care");
  await edit.getByLabel("Change reason").fill("Synthetic department rename");
  await edit
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await panel("Departments")
    .getByText("Intensive Care", { exact: true })
    .waitFor();
  const createRole = panel("Create a care-team role");
  await createRole
    .getByLabel("Department", { exact: true })
    .selectOption({ label: "Intensive Care" });
  await createRole.getByLabel("Team role name").fill("Intensive medical cover");
  await createRole.getByLabel("Role code").fill("intensive_medical");
  await createRole.getByLabel("Doctor / clinician", { exact: true }).check();
  for (const label of [
    "Read assigned journeys",
    "Document & comment",
    "Attest notes",
  ])
    await createRole.getByLabel(label, { exact: true }).check();
  await createRole
    .getByRole("button", { name: "Create team role", exact: true })
    .click();
  await panel("Shared team roles")
    .getByText("Intensive medical cover", { exact: true })
    .waitFor();
  await page.goto(base + "/dashboard/templates");
  const identity = panel("Facility identity");
  await identity.getByText("Add facility branding", { exact: true }).click();
  const branding = identity.locator("form").first();
  await branding
    .getByLabel("Facility document title")
    .fill("Synthetic Hospital Journey");
  await branding
    .getByLabel(/Facility logo \(PNG/)
    .setInputFiles(resolve("public/ccu360-logo.png"));
  await branding.getByAltText("Facility logo").waitFor();
  await expect
    .poll(() =>
      branding
        .getByAltText("Facility logo")
        .evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await branding
    .getByRole("button", { name: "Create facility branding", exact: true })
    .click();
  await identity
    .getByText("Synthetic Hospital Journey", { exact: true })
    .waitFor();
  const start = panel("Start a journey form");
  await start.getByLabel("Form name").fill("Synthetic Provider Ledger");
  await start.getByLabel("Facility branding").selectOption({ index: 1 });
  await start
    .getByRole("button", { name: "Create & open draft", exact: true })
    .click();
  const editor = page.getByRole("region", { name: "Saved draft editor" });
  await editor.waitFor();
  await editor
    .getByLabel("Apply a medical team role across all stages")
    .selectOption({ label: "Intensive medical cover" });
  await editor
    .getByRole("button", { name: "Add custom field", exact: true })
    .click();
  await editor
    .getByLabel("Field label", { exact: true })
    .last()
    .fill("Referral reason");
  await editor
    .getByLabel("Field type", { exact: true })
    .last()
    .selectOption("radio");
  await editor
    .getByLabel("Choices (one per line)")
    .last()
    .fill("Routine\nUrgent");
  await editor
    .getByRole("button", { name: "Add section", exact: true })
    .click();
  const custom = editor.locator("details").last();
  await custom
    .getByLabel("Section title", { exact: true })
    .fill("Specialist review");
  await custom.getByLabel("Intensive medical cover", { exact: true }).check();
  await editor
    .getByLabel("Change reason", { exact: true })
    .fill("Synthetic multidisciplinary form configuration");
  await editor
    .getByRole("button", { name: "Save draft changes", exact: true })
    .click();
  await editor
    .getByText("Draft saved. Preview and validate it before publication.")
    .waitFor();
  await editor
    .getByRole("button", { name: "Preview document", exact: true })
    .click();
  await editor.getByText("Referral reason", { exact: true }).waitFor();
  await page.screenshot({
    path: "/tmp/ccu360-journey-form-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "/tmp/ccu360-journey-form-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await editor
    .getByRole("button", { name: "Close editor", exact: true })
    .click();
  const library = panel("Form version library");
  const version = library
    .locator("article")
    .filter({ hasText: "Synthetic Provider Ledger" })
    .first();
  await version
    .getByRole("button", { name: "Edit saved draft", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Preview document", exact: true })
    .click();
  await editor.getByText("Referral reason", { exact: true }).waitFor();
  await editor
    .getByRole("button", { name: "Close editor", exact: true })
    .click();
  const validated = page.waitForResponse(
    (response) =>
      response.url().endsWith("/validate") &&
      response.request().method() === "POST",
  );
  await version
    .getByRole("button", { name: "Validate for publication", exact: true })
    .click();
  expect((await validated).status()).toBe(200);
  page.once("dialog", (dialog) => dialog.accept());
  await version
    .getByRole("button", { name: "Approve & publish", exact: true })
    .click();
  await version.getByText("published", { exact: true }).waitFor();
  await version.getByText("Retire version", { exact: true }).click();
  await version
    .getByLabel("Reason", { exact: true })
    .fill("Synthetic retirement rehearsal");
  await version
    .getByRole("button", { name: "Archive this version", exact: true })
    .click();
  await version.getByText("retired", { exact: true }).waitFor();
  console.log(
    "PASS provider department editing, shared role creation, logo upload, saved field/section customization, desktop/mobile preview, publication validation and retirement",
  );
}

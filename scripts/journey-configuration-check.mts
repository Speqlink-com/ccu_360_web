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
  await edit.evaluate((form) => {
    (form as HTMLFormElement).noValidate = true;
  });
  await edit.getByLabel("Department name").fill("X");
  await edit.getByLabel("Department code").fill("INVALID CODE");
  await edit.getByLabel("Change reason").fill("Synthetic validation check");
  await edit
    .getByRole("button", { name: "Save department", exact: true })
    .click();
  await edit
    .getByRole("alert")
    .getByText("Check the form details", { exact: true })
    .waitFor();
  await expect(edit.getByLabel("Department name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(edit.getByLabel("Department name")).toBeFocused();
  await expect(edit.getByLabel("Department code")).toHaveValue("INVALID CODE");
  await expect(edit.getByRole("alert")).not.toContainText("password");
  await page.screenshot({
    path: "/tmp/ccu360-field-validation-desktop.png",
    fullPage: true,
  });
  await edit.getByLabel("Department code").fill("critical_care");
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
    "Open journeys",
    "Read linked journeys",
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
  const editor = page.getByRole("region", { name: "Journey form editor" });
  await editor.waitFor();
  await editor
    .getByRole("button", { name: "Close editor", exact: true })
    .click();
  const initialVersion = panel("Form version library")
    .locator("article")
    .filter({ hasText: "Synthetic Provider Ledger" })
    .first();
  page.once("dialog", (dialog) => dialog.accept());
  await initialVersion
    .getByRole("button", { name: "Approve & publish", exact: true })
    .click();
  const publicationError = initialVersion.getByRole("alert");
  await publicationError.waitFor();
  await expect(publicationError).not.toContainText("password");
  await expect(
    publicationError.getByText("Support details", { exact: true }),
  ).toBeVisible();
  await expect(publicationError.locator("details")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.screenshot({
    path: "/tmp/ccu360-publication-error-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    console.log(
      "Mobile layout diagnostics",
      await page.evaluate(() =>
        [...document.querySelectorAll("*")]
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            right: Math.round(e.getBoundingClientRect().right),
            width: Math.round(e.getBoundingClientRect().width),
          }))
          .filter((e) => e.right > innerWidth + 1)
          .slice(0, 15),
      ),
    );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "/tmp/ccu360-publication-error-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await initialVersion
    .getByRole("button", { name: "Edit saved draft", exact: true })
    .click();
  await editor.waitFor();

  await editor
    .getByRole("button", { name: "Teams & permissions", exact: false })
    .click();
  await editor
    .getByLabel("Link Intensive medical cover", { exact: true })
    .check();
  await editor
    .getByLabel("Intake Intensive medical cover", { exact: true })
    .check();
  await editor
    .getByRole("button", { name: "Build form", exact: false })
    .click();
  const properties = editor.getByRole("complementary", {
    name: "Component properties",
  });
  await properties.getByLabel("Section purpose").selectOption("clinical");
  await properties
    .getByLabel("Write Intensive medical cover", { exact: true })
    .check();
  const palette = editor.getByRole("complementary", {
    name: "Component library",
  });
  await palette
    .getByRole("button", { name: "Single choice", exact: false })
    .click();
  await properties
    .getByLabel("Field label", { exact: true })
    .fill("Referral reason");
  await properties.getByLabel("Choices (one per line)").fill("Routine\nUrgent");
  await palette
    .getByRole("button", { name: "Repeating table", exact: false })
    .click();
  await properties
    .getByLabel("Field label", { exact: true })
    .fill("Results table");
  const columns = properties.getByRole("group", {
    name: "Table columns",
    exact: true,
  });
  await columns.getByLabel("Column label", { exact: true }).fill("Test name");
  await columns
    .getByRole("button", { name: "Add column", exact: true })
    .click();
  await columns
    .getByLabel("Column label", { exact: true })
    .last()
    .fill("Measured result");
  await columns
    .getByLabel("Input type", { exact: true })
    .last()
    .selectOption("number");
  await expect(
    editor.getByRole("button", { name: "Undo form change" }),
  ).toBeEnabled();
  await editor.getByRole("button", { name: "Undo form change" }).click();
  await expect(
    columns.getByLabel("Input type", { exact: true }).last(),
  ).toHaveValue("text");
  await editor.getByRole("button", { name: "Redo form change" }).click();
  await expect(
    columns.getByLabel("Input type", { exact: true }).last(),
  ).toHaveValue("number");
  await page.screenshot({
    path: "/tmp/ccu360-form-builder-desktop.png",
    fullPage: true,
  });
  await editor.getByRole("button", { name: "PDF pages", exact: false }).click();
  const studio = editor.getByRole("region", { name: "Document design studio" });
  await expect(
    studio.getByRole("button", { name: "Apply page layout", exact: true }),
  ).toBeEnabled({ timeout: 120000 });
  await page.screenshot({
    path: "/tmp/ccu360-document-studio-desktop.png",
    fullPage: true,
  });
  await studio
    .getByRole("button", { name: "Apply page layout", exact: true })
    .click();
  await editor
    .getByLabel("Change reason", { exact: true })
    .fill("Synthetic multidisciplinary form configuration");
  await editor
    .getByRole("button", { name: "Save draft changes", exact: true })
    .click();
  await editor
    .getByText(
      "Draft saved. Review the preview, then validate for publication.",
      { exact: true },
    )
    .waitFor();
  await editor
    .getByRole("button", { name: "Preview & test", exact: false })
    .click();
  await editor.getByText("Referral reason", { exact: true }).waitFor();
  await editor.getByRole("radio", { name: "Urgent", exact: true }).check();
  await page.screenshot({
    path: "/tmp/ccu360-journey-form-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    console.log(
      "Mobile layout diagnostics",
      await page.evaluate(() =>
        [...document.querySelectorAll("*")]
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            right: Math.round(e.getBoundingClientRect().right),
            width: Math.round(e.getBoundingClientRect().width),
          }))
          .filter((e) => e.right > innerWidth + 1)
          .slice(0, 15),
      ),
    );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
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
    .getByRole("button", { name: "Preview & test", exact: false })
    .click();
  await editor.getByText("Referral reason", { exact: true }).waitFor();
  await editor
    .getByRole("button", { name: "PDF document", exact: true })
    .click();
  await expect(
    editor.getByRole("button", { name: "Download preview PDF", exact: true }),
  ).toBeEnabled({ timeout: 120000 });
  const pdf = page.waitForEvent("download");
  await editor
    .getByRole("button", { name: "Download preview PDF", exact: true })
    .click();
  await (await pdf).saveAs("/tmp/ccu360-studio-template-preview.pdf");
  await editor
    .getByRole("button", { name: "Review & publish", exact: false })
    .click();
  await expect(
    editor.getByRole("button", { name: "Approve & publish", exact: true }),
  ).toBeDisabled();
  const validated = page.waitForResponse(
    (response) =>
      response.url().endsWith("/validate") &&
      response.request().method() === "POST",
  );
  await editor
    .getByRole("button", { name: "Validate for publication", exact: true })
    .click();
  expect((await validated).status()).toBe(200);
  await editor
    .getByRole("button", { name: "Approve & publish", exact: true })
    .click();
  const approval = editor.getByRole("dialog");
  await approval.getByRole("checkbox").check();
  await approval
    .getByRole("button", { name: "Publish approved version", exact: true })
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

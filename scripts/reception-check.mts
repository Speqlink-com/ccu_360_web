/** Reception acceptance against the runner's isolated FastAPI fixture. */
import { expect, type Browser, type Page } from "@playwright/test";
export async function checkReception({
  browser,
  base,
  password,
  signIn,
  chooseFacility,
}: {
  browser: Browser;
  base: string;
  password: string;
  signIn: (
    page: Page,
    base: string,
    email: string,
    password: string,
  ) => Promise<void>;
  chooseFacility: (page: Page) => Promise<void>;
}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const panel = (title: string) =>
    page
      .locator("section.live-panel")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  try {
    await signIn(page, base, "receptionist-e2e@example.org", password);
    await chooseFacility(page);
    await page.goto(base + "/dashboard/patients");
    await page
      .getByRole("heading", {
        name: "Reception & patient registry",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Register a new patient", exact: true })
      .click();
    const form = panel("Register patient");
    await form
      .getByLabel("Patient full name", { exact: true })
      .fill("Synthetic Reception Patient");
    await form
      .getByLabel("Facility IP number", { exact: true })
      .fill("SYNTHETIC-RECEPTION-001");
    await form
      .getByLabel("Date of birth (optional)", { exact: true })
      .fill("1990-05-20");
    await form.getByLabel("Sex", { exact: true }).selectOption("female");
    await form
      .getByLabel("Telephone number (optional)", { exact: true })
      .fill("+254700001111");
    await form
      .getByRole("button", { name: "Register patient", exact: true })
      .click();
    const profile = panel("Patient profile");
    await profile
      .getByRole("heading", {
        name: "Synthetic Reception Patient",
        exact: true,
      })
      .waitFor();
    const number = (await profile
      .locator("strong.font-mono")
      .textContent())!.trim();
    expect(number).toMatch(/^\d{6}$/);
    const intake = panel("Record patient arrival");
    await expect(intake.getByLabel(/Bed|Inpatient|Outpatient/)).toHaveCount(0);
    await intake.getByRole("radio", { name: /Referred/ }).check();
    await intake
      .getByLabel("Referring facility", { exact: true })
      .fill("Synthetic Referral Hospital");
    await intake
      .getByLabel("Referral reference (optional)", { exact: true })
      .fill("SYN-REF-001");
    await intake
      .getByLabel("Reception note (optional)", { exact: true })
      .fill("Synthetic referral intake note.");
    await intake
      .getByLabel("Journey form to start (optional)", { exact: true })
      .selectOption({ index: 1 });
    await intake
      .getByRole("button", { name: "Record arrival & continue", exact: true })
      .click();
    const recorded = page.getByRole("region", { name: "Recorded arrival" });
    await recorded
      .getByRole("heading", { name: "Arrival recorded", exact: true })
      .waitFor();
    await expect(recorded).toContainText("First recorded visit");
    await expect(recorded).toContainText("Synthetic Referral Hospital");
    await page.screenshot({
      path: "/tmp/ccu360-reception-profile-desktop.png",
      fullPage: true,
    });
    const link = recorded.getByRole("link", { name: /Open ledger/ });
    const sharedUrl = base + (await link.getAttribute("href"))!;
    await link.click();
    await page
      .getByRole("heading", {
        name: "Synthetic Reception Patient",
        exact: true,
      })
      .waitFor();
    await expect(page.getByLabel(/Professional note/)).toHaveCount(0);
    await page
      .getByLabel("Reason for visit", { exact: false })
      .fill("Synthetic reception intake for shared care.");
    await page
      .getByRole("button", { name: "Post section information", exact: true })
      .click();
    const sharedIntake = page.getByRole("region", {
      name: "Reception & patient intake ledger section",
      exact: true,
    });
    await sharedIntake.scrollIntoViewIfNeeded();
    await sharedIntake
      .getByText("Synthetic reception intake for shared care.", { exact: true })
      .waitFor();
    await page.goto(base + "/dashboard/patients");
    const directory = panel("Facility patient directory");
    await directory
      .getByLabel("Search by", { exact: true })
      .selectOption("ccu360_number");
    await directory
      .getByLabel("Search patient name, IP or CCU360 number (optional)", {
        exact: true,
      })
      .fill(number);
    await directory
      .getByRole("button", { name: "Search patients", exact: true })
      .click();
    const row = directory.locator("tbody tr").filter({ hasText: number });
    await row
      .getByRole("button", { name: "Open patient", exact: true })
      .click();
    const returning = panel("Record patient arrival");
    await returning
      .getByRole("button", { name: "Record arrival & continue", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Recorded arrival" })
      .getByText(/Returning patient/)
      .waitFor();
    await page
      .getByRole("button", { name: "Arrival history", exact: true })
      .click();
    const history = panel("Arrival history");
    await expect(history.locator("article")).toHaveCount(2);
    await expect(history).toContainText("Synthetic Referral Hospital");
    await page
      .getByRole("button", { name: "Correct patient details", exact: true })
      .click();
    await profile
      .getByLabel("Facility IP number", { exact: true })
      .fill("SYNTHETIC-RECEPTION-UPDATED");
    await profile
      .getByLabel("Correction reason", { exact: true })
      .fill("Synthetic verified identifier correction");
    await profile
      .getByRole("button", { name: "Save profile correction", exact: true })
      .click();
    await profile
      .getByText("SYNTHETIC-RECEPTION-UPDATED", { exact: true })
      .waitFor();
    await expect(profile.locator("strong.font-mono")).toHaveText(number);
    await page
      .getByRole("button", { name: "Profile changes", exact: true })
      .click();
    await page
      .getByText("Synthetic verified identifier correction", { exact: true })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: "/tmp/ccu360-reception-profile-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "Back to directory", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Arrival queue", exact: true })
      .click();
    const queue = panel("Reception arrival queue");
    await queue
      .getByLabel("Patient name or number (optional)", { exact: true })
      .fill(number);
    await queue
      .getByLabel("Arrival source (optional)", { exact: true })
      .selectOption("referral");
    await queue
      .getByRole("button", { name: "Filter arrivals", exact: true })
      .click();
    await expect(queue.locator("tbody tr")).toHaveCount(1);
    await expect(queue).toContainText("Synthetic Referral Hospital");
    await page
      .getByRole("button", { name: "Patient directory", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Register a new patient", exact: true })
      .click();
    const duplicate = panel("Register patient");
    await duplicate
      .getByLabel("Patient full name", { exact: true })
      .fill("Synthetic Reception Patient");
    await duplicate
      .getByLabel("Facility IP number", { exact: true })
      .fill("SYNTHETIC-DUPLICATE");
    await duplicate
      .getByLabel("Date of birth (optional)", { exact: true })
      .fill("1990-05-20");
    await duplicate
      .getByRole("button", { name: "Register patient", exact: true })
      .click();
    const review = page.getByRole("region", {
      name: "Possible duplicate patients",
    });
    await review.waitFor();
    await expect(
      review.getByRole("button", {
        name: "Register distinct patient",
        exact: true,
      }),
    ).toBeDisabled();
    await review
      .getByRole("button", { name: "Use existing patient", exact: true })
      .click();
    await profile
      .getByRole("heading", {
        name: "Synthetic Reception Patient",
        exact: true,
      })
      .waitFor();
    const alliedContext = await browser.newContext();
    const allied = await alliedContext.newPage();
    allied.setDefaultTimeout(60_000);
    try {
      await signIn(allied, base, "allied-e2e@example.org", password);
      await chooseFacility(allied);
      await allied.goto(base + "/dashboard/patients");
      await expect(
        allied.getByRole("button", {
          name: "Register a new patient",
          exact: true,
        }),
      ).toHaveCount(0);
      await allied.goto(sharedUrl);
      await allied
        .getByRole("heading", {
          name: "Synthetic Reception Patient",
          exact: true,
        })
        .waitFor();
      const complete = allied.getByRole("region", {
        name: "Complete shared patient ledger",
      });
      await expect(complete.getByRole("region")).toHaveCount(10);
      await expect(
        complete.getByRole("button", { name: "Complete section", exact: true }),
      ).toHaveCount(0);
      const section = allied.getByRole("region", {
        name: "Reception & patient intake ledger section",
      });
      await section.scrollIntoViewIfNeeded();
      await section
        .getByText("Synthetic reception intake for shared care.", {
          exact: true,
        })
        .waitFor();
    } finally {
      await alliedContext.close();
    }
    console.log(
      "PASS reception profile registration, unique CCU360 number, referral first visit, returning walk-in, correction audit, number search, queue filters, duplicate prevention, mobile layout and complete shared ledger",
    );
  } catch (error) {
    await page
      .screenshot({ path: "/tmp/ccu360-reception-failure.png", fullPage: true })
      .catch(() => {});
    console.error(await page.locator(".request-error").allTextContents());
    throw error;
  } finally {
    await context.close();
  }
}

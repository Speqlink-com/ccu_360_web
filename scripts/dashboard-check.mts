/** Dashboard acceptance uses only the runner's disposable accounts and database. */
import { expect, type Page } from "@playwright/test";

export async function checkDashboard(page: Page, base: string, role: string) {
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(base + "/dashboard");
  await page.getByRole("heading", { name: /^Welcome,/ }).waitFor();
  await page
    .getByRole("button", { name: "Refresh dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Refresh dashboard", exact: true }),
  ).toBeEnabled();
  const snapshot = page.getByRole("region", {
    name: "Workspace snapshot",
    exact: true,
  });
  await expect(snapshot.locator("a")).toHaveCount(4);
  // Wait for real server-backed previews, rather than capturing placeholder figures.
  await expect
    .poll(() => snapshot.locator("a > strong").allTextContents())
    .not.toContain("—");
  await expect
    .poll(() =>
      page
        .locator(".workspace img")
        .evaluateAll((nodes) =>
          nodes.every(
            (n) =>
              (n as HTMLImageElement).complete &&
              (n as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await expect(page.locator(".request-error")).toHaveCount(0);
  const regions = page.locator(".dashboard-panel-scroll");
  if (role === "ahs") {
    const facilityRegion = page.getByRole("region", {
      name: "Facility network preview",
      exact: true,
    });
    await expect
      .poll(() =>
        facilityRegion.evaluate((n) => n.scrollHeight > n.clientHeight),
      )
      .toBe(true);
    await facilityRegion.focus();
    await page.keyboard.press("End");
    await expect
      .poll(() => facilityRegion.evaluate((n) => n.scrollTop))
      .toBeGreaterThan(0);
    await facilityRegion.evaluate((n) => {
      n.scrollTop = 0;
    });
  }
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `/tmp/ccu360-premium-${role}-desktop.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Workspace navigation", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Workspace navigation", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `/tmp/ccu360-premium-${role}-mobile.png`,
    fullPage: true,
  });
  await expect(regions.first()).toBeVisible();
  if (originalViewport) await page.setViewportSize(originalViewport);
  console.log(
    `PASS ${role} dashboard: real previews, supplied icons, desktop/mobile layout, navigation and component scrolling`,
  );
}

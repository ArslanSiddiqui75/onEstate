import { expect, test } from "@playwright/test";
import { expectCleanPage, loginAsOwner, watchPage } from "./helpers";

const ROUTES = [
  "/app",
  "/app/conversations",
  "/app/opportunities",
  "/app/opportunities?view=deals",
  "/app/diary",
  "/app/tasks",
  "/app/contacts",
  "/app/listings",
  "/app/lettings",
  "/app/automations",
  "/app/website",
  "/app/social",
  "/app/settings",
  "/app/settings/team",
  "/app/settings/phone-system",
  "/app/settings/social",
  "/app/settings/reports",
  "/app/settings/documents",
  "/app/settings/support",
  "/app/settings/billing",
];

test.describe("signed-in workspace", () => {
  test("every module opens cleanly (no errors, CSP violations or overflow)", async ({ page }) => {
    const problems = watchPage(page);
    await loginAsOwner(page);
    for (const route of ROUTES) {
      problems.length = 0;
      await page.goto(route);
      await expect(page.locator("body")).toContainText(/\S{3,}/, { timeout: 15_000 });
      await page.waitForTimeout(600);
      await expectCleanPage(page);
      expect(problems, `problems on ${route}`).toEqual([]);
    }
  });

  test("mobile layout does not overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsOwner(page);
    for (const route of ["/app", "/app/conversations", "/app/opportunities", "/app/tasks"]) {
      await page.goto(route);
      await page.waitForTimeout(600);
      await expectCleanPage(page);
    }
  });

  test("copy-booking-link reports honestly when online booking is closed", async ({ page }) => {
    test.skip(!seeded, "needs the seeded dev workspace");
    await loginAsOwner(page);
    await page.goto("/app/diary");
    const button = page.getByRole("button", { name: /copy booking link/i });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByText(/booking link copied|copy this link|aren’t open yet/i).first()).toBeVisible();
  });
});

// Core flows rely on the seeded local workspace used by `next dev`; a production
// build starts new accounts at onboarding instead.
const seeded = !process.env.E2E_BASE_URL || Boolean(process.env.E2E_SEEDED);

test.describe("core flows", () => {
  test.skip(!seeded, "needs the seeded dev workspace");

  test("add a lead, reject a duplicate, and see it in the list", async ({ page }) => {
    const problems = watchPage(page);
    await loginAsOwner(page);
    await page.goto("/app/opportunities");
    const name = `E2E Lead ${Date.now()}`;
    const email = `e2e-${Date.now()}@example.com`;

    const fill = async (leadName: string) => {
      await page.getByRole("button", { name: /^add lead$/i }).click();
      await page.locator("input[name=name]").fill(leadName);
      await page.locator("input[name=email]").fill(email);
      await page.locator("form", { has: page.locator("input[name=name]") }).getByRole("button", { name: /add|save|create/i }).last().click();
    };

    await fill(name);
    await expect(page.getByText(`Lead "${name}" added`).first()).toBeVisible();
    await expect(page.getByText(name).first()).toBeVisible();

    await fill(`${name} again`);
    await expect(page.getByText(/already a lead with these details/i).first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("add a task from the tasks page", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/app/tasks");
    await page.getByRole("button", { name: /add task/i }).first().click();
    await expect(page.getByRole("dialog").or(page.locator("form").last())).toBeVisible();
  });
});

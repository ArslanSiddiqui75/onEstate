import { expect, test } from "@playwright/test";
import { expectCleanPage, watchPage } from "./helpers";

for (const path of ["/", "/UK", "/US", "/app/login", "/app/signup"]) {
  test(`public page ${path} renders without errors`, async ({ page }) => {
    const problems = watchPage(page);
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toBeEmpty();
    await page.waitForTimeout(500);
    await expectCleanPage(page);
    expect(problems).toEqual([]);
  });
}

test("responses carry security headers including a script-source CSP", async ({ request }) => {
  const res = await request.get("/UK");
  const headers = res.headers();
  const csp = headers["content-security-policy"] || "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("protected API routes reject anonymous requests", async ({ request }) => {
  for (const path of ["/api/documents", "/api/portals/connections", "/api/team/invite"]) {
    const res = await request.get(path);
    expect([401, 403, 405]).toContain(res.status());
  }
  const cron = await request.get("/api/automations/cron/run?secret=anything");
  expect([401, 503]).toContain(cron.status());
});

test("booking page offers only future slots", async ({ page }) => {
  await page.goto("/book/harbour");
  const slots = page.locator("input[name=at]");
  const count = await slots.count();
  if (count === 0) {
    // Production without the demo inbox: the page must say so instead of showing a dead form.
    await expect(page.getByText(/isn’t taking online requests/i)).toBeVisible();
    return;
  }
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const value = await slots.nth(i).getAttribute("value");
    expect(Date.parse(value || "")).toBeGreaterThan(now);
  }
});

test("unknown booking links are not accepted", async ({ page }) => {
  await page.goto("/book/not-a-real-token");
  await expect(page.getByText(/not recognised|isn’t taking online requests/i)).toBeVisible();
  await expect(page.locator("form[action='/api/agency']")).toHaveCount(0);
});

test("invite page loads without Checkout for a bogus token", async ({ page }) => {
  const res = await page.goto("/app/invite?token=not-a-real-invite-token");
  expect(res?.status()).toBeLessThan(500);
  await expect(page.locator("body")).toContainText(/invite|invalid|expired|sign/i);
  await expect(page.locator("text=/checkout|stripe/i")).toHaveCount(0);
});

test("unknown public site slug is unavailable", async ({ page }) => {
  const res = await page.goto("/site/not-a-real-slug-xyz");
  expect(res?.status()).toBeLessThan(500);
  await expect(page.locator("body")).toContainText(/not found|unavailable|unpublished|doesn’t exist|does not exist/i);
});

test("bogus e-sign token is not recognised", async ({ page }) => {
  await page.goto("/sign/too-short");
  await expect(page.locator("body")).toContainText(/invalid|recognised|recognized|not found|simulated/i);
});

test("bogus repair report token is not recognised", async ({ page }) => {
  await page.goto("/report/not-a-real-token");
  await expect(page.locator("body")).toContainText(/not recognised|not recognized|isn’t|isn't|unavailable|unrecognised/i);
});

test("anonymous esign complete rejects bad tokens", async ({ request }) => {
  const res = await request.post("/api/esign/complete", {
    data: { token: "short" },
  });
  expect([400, 404, 429]).toContain(res.status());
});

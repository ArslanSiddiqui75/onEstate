import { expect, type Page } from "@playwright/test";

const IGNORED = [/Download the React DevTools/i, /favicon/i, /Fast Refresh/i, /\[HMR\]/i];

/** Collects uncaught errors, failed API calls and CSP violations for a page. */
export function watchPage(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message.slice(0, 200)}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED.some((re) => re.test(text))) return;
    if (/Failed to load resource/.test(text)) return;
    problems.push(`console: ${text.slice(0, 200)}`);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400 && !url.includes("/_next/image")) {
      problems.push(`${res.status()} ${url.slice(0, 120)}`);
    }
  });
  return problems;
}

export async function loginAsOwner(page: Page) {
  await page.goto("/app/login");
  await page.locator("input[type=email]").fill("owner@certified.local");
  await page.locator("input[type=password]").fill("CertifiedDev1!");
  await page.locator("form").first().evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await page.waitForURL((url) => url.pathname.startsWith("/app") && !url.pathname.includes("login"), {
    timeout: 30_000,
  });
  await expect(page.locator("body")).toContainText(/sign out/i, { timeout: 30_000 });
}

export async function expectCleanPage(page: Page) {
  const body = await page.locator("body").innerText();
  for (const bad of ["undefined", "NaN", "[object Object]", "Application error", "Something went wrong"]) {
    expect(body, `page text contains "${bad}"`).not.toContain(bad);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow, "page scrolls horizontally").toBe(false);
}

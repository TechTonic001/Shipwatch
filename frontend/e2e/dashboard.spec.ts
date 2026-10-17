import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const screenshots = resolve(root, "../docs/screenshots");

test("demo dashboard is responsive and accessible", async ({ page }) => {
  await mkdir(screenshots, { recursive: true });
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?demo=1");
    await expect(page.getByText("Demo data")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Production overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent runs" })).toBeVisible();
    await page.screenshot({ path: resolve(screenshots, `dashboard-${width}.png`), fullPage: true });
    const dimensions = await page.locator("html").evaluate((element) => ({
      document: element.scrollWidth,
      viewport: window.innerWidth,
      offenders: Array.from(document.querySelectorAll("body *"))
        .filter((child) => child.getBoundingClientRect().right > window.innerWidth)
        .slice(0, 5)
        .map((child) => ({ tag: child.tagName, className: child.className, right: child.getBoundingClientRect().right }))
    }));
    expect(dimensions.document <= dimensions.viewport, `horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBe(true);
  }
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.emulateMedia({ colorScheme: "light" });
  const lightAccessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(lightAccessibility.violations).toEqual([]);
});

test("incident and empty demo variants stay isolated from the API", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/repos")) apiRequests.push(request.url());
  });
  await page.goto("/?demo=incident");
  await expect(page.getByText("Demo data")).toBeVisible();
  await expect(page.getByText(/Production incident open for/)).toBeVisible();
  await expect(page.getByText("production is affected · latest failed SHA: f09e81c")).toBeVisible();
  await page.goto("/?demo=empty");
  await expect(page.getByText("No data in this window").first()).toBeVisible();
  await expect(page.getByText("Your delivery data will appear here")).toBeVisible();
  expect(apiRequests).toEqual([]);
});

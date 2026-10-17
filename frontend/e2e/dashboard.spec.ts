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
    const hasHorizontalOverflow = await page.locator("html").evaluate((element) => element.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow, `horizontal overflow at ${width}px`).toBe(false);
  }
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
});

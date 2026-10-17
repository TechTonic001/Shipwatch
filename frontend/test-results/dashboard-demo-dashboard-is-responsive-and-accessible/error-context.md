# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> demo dashboard is responsive and accessible
- Location: e2e\dashboard.spec.ts:10:1

# Error details

```
Error: horizontal overflow at 360px

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - link "shipwatch" [ref=e7] [cursor=pointer]:
          - /url: "#dashboard"
          - text: Sshipwatch
        - text: Demo data
      - generic [ref=e8]:
        - generic [ref=e9]:
          - text: ⌘Repository
          - combobox "Repository" [ref=e10]:
            - option "acme/shipwatch-api" [selected]
        - group "Metric window" [ref=e11]:
          - button "7d" [pressed] [ref=e12]
          - button "30d" [ref=e13]
        - generic "Live, refreshed 0s ago" [ref=e14]:
          - text: Live
          - generic [ref=e15]: · 0s ago
        - button "Sign out" [ref=e16]
  - main [ref=e17]:
    - generic [ref=e18]:
      - generic [ref=e19]:
        - paragraph [ref=e20]: Delivery health
        - heading "Production overview" [level=1] [ref=e21]
      - paragraph [ref=e22]: Updated 0s ago
    - generic [ref=e23]:
      - generic [ref=e24]:
        - text: ✓
        - generic [ref=e25]:
          - paragraph [ref=e26]: All clear
          - paragraph [ref=e27]: Last deploy 12 min ago · abc1234
      - generic [ref=e28]: Healthy
    - region "Delivery metrics" [ref=e29]:
      - article [ref=e30]:
        - generic [ref=e31]:
          - heading "Deployment frequency" [level=2] [ref=e32]
          - generic [ref=e33]:
            - button "Deployment frequency definition" [ref=e34]: i
            - tooltip "Successful production deployments per day in the selected UTC window." [ref=e35]
        - paragraph [ref=e36]: "1.1"
        - paragraph [ref=e37]: 8 successful · per day
      - article [ref=e38]:
        - generic [ref=e39]:
          - heading "Change failure rate" [level=2] [ref=e40]
          - generic [ref=e41]:
            - button "Change failure rate definition" [ref=e42]: i
            - tooltip "Production deployments ending in failure or error divided by successful, failed, or errored production deployments." [ref=e43]
        - paragraph [ref=e44]: 8.3%
        - paragraph [ref=e45]: 1 failed / 12 total
      - article [ref=e46]:
        - generic [ref=e47]:
          - heading "MTTR" [level=2] [ref=e48]
          - generic [ref=e49]:
            - button "MTTR definition" [ref=e50]: i
            - tooltip "Median time from incident opened to resolved, using incidents resolved within this window. Secondary value is the 90th percentile." [ref=e51]
        - paragraph [ref=e52]: 31m
        - paragraph [ref=e53]: p90 72m · 4 resolved
    - region [ref=e54]:
      - generic [ref=e55]:
        - generic [ref=e56]:
          - heading "Deployments per day" [level=2] [ref=e57]
          - paragraph [ref=e58]: Successful production deployments
        - button "View as table" [ref=e59]
      - img "Bar chart of successful production deployments by day"
      - paragraph [ref=e60]: Failed deployment counts are not included in this API response.
    - generic [ref=e61]:
      - region [ref=e62]:
        - generic [ref=e63]:
          - heading "Recent incidents" [level=2] [ref=e64]
          - generic [ref=e65]: 0 total
        - paragraph [ref=e66]: No incidents recorded in this feed.
      - region [ref=e68]:
        - generic [ref=e69]:
          - heading "Recent runs" [level=2] [ref=e70]
          - generic [ref=e71]: 10 shown
        - table [ref=e73]:
          - caption [ref=e74]: Recent deployment runs
          - rowgroup [ref=e75]:
            - row [ref=e76]:
              - columnheader "Environment" [ref=e77]
              - columnheader "SHA" [ref=e78]
              - columnheader "Status" [ref=e79]
              - columnheader "Duration" [ref=e80]
              - columnheader "Started" [ref=e81]
          - rowgroup [ref=e82]:
            - row [ref=e83]:
              - cell "production" [ref=e84]
              - cell "abc1234" [ref=e85]
              - cell "Succeeded" [ref=e86]:
                - generic [ref=e87]: ✓Succeeded
              - cell "1m 0s" [ref=e88]
              - cell "12m ago" [ref=e89]
            - row [ref=e90]:
              - cell "production" [ref=e91]
              - cell "f09e81c" [ref=e92]
              - cell "Failed" [ref=e93]:
                - generic [ref=e94]: ×Failed
              - cell "1m 0s" [ref=e95]
              - cell "49m ago" [ref=e96]
            - row [ref=e97]:
              - cell "staging" [ref=e98]
              - cell "4b6c0e2" [ref=e99]
              - cell "Succeeded" [ref=e100]:
                - generic [ref=e101]: ✓Succeeded
              - cell "1m 0s" [ref=e102]
              - cell "1h ago" [ref=e103]
            - row [ref=e104]:
              - cell "production" [ref=e105]
              - cell "d8a214f" [ref=e106]
              - cell "Succeeded" [ref=e107]:
                - generic [ref=e108]: ✓Succeeded
              - cell "1m 0s" [ref=e109]
              - cell "2h ago" [ref=e110]
            - row [ref=e111]:
              - cell "production" [ref=e112]
              - cell "abc1234" [ref=e113]
              - cell "Succeeded" [ref=e114]:
                - generic [ref=e115]: ✓Succeeded
              - cell "1m 0s" [ref=e116]
              - cell "2h ago" [ref=e117]
            - row [ref=e118]:
              - cell "production" [ref=e119]
              - cell "f09e81c" [ref=e120]
              - cell "Failed" [ref=e121]:
                - generic [ref=e122]: ×Failed
              - cell "1m 0s" [ref=e123]
              - cell "3h ago" [ref=e124]
            - row [ref=e125]:
              - cell "staging" [ref=e126]
              - cell "4b6c0e2" [ref=e127]
              - cell "Succeeded" [ref=e128]:
                - generic [ref=e129]: ✓Succeeded
              - cell "1m 0s" [ref=e130]
              - cell "3h ago" [ref=e131]
            - row [ref=e132]:
              - cell "production" [ref=e133]
              - cell "d8a214f" [ref=e134]
              - cell "Succeeded" [ref=e135]:
                - generic [ref=e136]: ✓Succeeded
              - cell "1m 0s" [ref=e137]
              - cell "4h ago" [ref=e138]
            - row [ref=e139]:
              - cell "production" [ref=e140]
              - cell "abc1234" [ref=e141]
              - cell "Succeeded" [ref=e142]:
                - generic [ref=e143]: ✓Succeeded
              - cell "1m 0s" [ref=e144]
              - cell "5h ago" [ref=e145]
            - row [ref=e146]:
              - cell "production" [ref=e147]
              - cell "f09e81c" [ref=e148]
              - cell "Failed" [ref=e149]:
                - generic [ref=e150]: ×Failed
              - cell "1m 0s" [ref=e151]
              - cell "5h ago" [ref=e152]
        - list [ref=e153]:
          - listitem [ref=e154]:
            - generic [ref=e155]:
              - text: production
              - generic [ref=e156]: ✓Succeeded
            - generic [ref=e157]:
              - text: abc12341m 0s
              - time [ref=e158]: 12m ago
          - listitem [ref=e159]:
            - generic [ref=e160]:
              - text: production
              - generic [ref=e161]: ×Failed
            - generic [ref=e162]:
              - text: f09e81c1m 0s
              - time [ref=e163]: 49m ago
          - listitem [ref=e164]:
            - generic [ref=e165]:
              - text: staging
              - generic [ref=e166]: ✓Succeeded
            - generic [ref=e167]:
              - text: 4b6c0e21m 0s
              - time [ref=e168]: 1h ago
          - listitem [ref=e169]:
            - generic [ref=e170]:
              - text: production
              - generic [ref=e171]: ✓Succeeded
            - generic [ref=e172]:
              - text: d8a214f1m 0s
              - time [ref=e173]: 2h ago
          - listitem [ref=e174]:
            - generic [ref=e175]:
              - text: production
              - generic [ref=e176]: ✓Succeeded
            - generic [ref=e177]:
              - text: abc12341m 0s
              - time [ref=e178]: 2h ago
          - listitem [ref=e179]:
            - generic [ref=e180]:
              - text: production
              - generic [ref=e181]: ×Failed
            - generic [ref=e182]:
              - text: f09e81c1m 0s
              - time [ref=e183]: 3h ago
          - listitem [ref=e184]:
            - generic [ref=e185]:
              - text: staging
              - generic [ref=e186]: ✓Succeeded
            - generic [ref=e187]:
              - text: 4b6c0e21m 0s
              - time [ref=e188]: 3h ago
          - listitem [ref=e189]:
            - generic [ref=e190]:
              - text: production
              - generic [ref=e191]: ✓Succeeded
            - generic [ref=e192]:
              - text: d8a214f1m 0s
              - time [ref=e193]: 4h ago
          - listitem [ref=e194]:
            - generic [ref=e195]:
              - text: production
              - generic [ref=e196]: ✓Succeeded
            - generic [ref=e197]:
              - text: abc12341m 0s
              - time [ref=e198]: 5h ago
          - listitem [ref=e199]:
            - generic [ref=e200]:
              - text: production
              - generic [ref=e201]: ×Failed
            - generic [ref=e202]:
              - text: f09e81c1m 0s
              - time [ref=e203]: 5h ago
        - button "Load more" [ref=e204]
  - contentinfo [ref=e205]:
    - generic [ref=e206]:
      - generic [ref=e207]:
        - generic [ref=e208]:
          - text: Backend
          - code [ref=e209]: local
        - generic [ref=e210]:
          - text: Frontend
          - code [ref=e211]: local
      - link "Metric definitions" [ref=e212] [cursor=pointer]:
        - /url: /docs/metrics.md
```

# Test source

```ts
  1  | import AxeBuilder from "@axe-core/playwright";
  2  | import { expect, test } from "@playwright/test";
  3  | import { mkdir } from "node:fs/promises";
  4  | import { fileURLToPath } from "node:url";
  5  | import { dirname, resolve } from "node:path";
  6  | 
  7  | const root = dirname(dirname(fileURLToPath(import.meta.url)));
  8  | const screenshots = resolve(root, "../docs/screenshots");
  9  | 
  10 | test("demo dashboard is responsive and accessible", async ({ page }) => {
  11 |   await mkdir(screenshots, { recursive: true });
  12 |   for (const width of [360, 768, 1280]) {
  13 |     await page.setViewportSize({ width, height: 900 });
  14 |     await page.goto("/?demo=1");
  15 |     await expect(page.getByText("Demo data")).toBeVisible();
  16 |     await expect(page.getByRole("heading", { name: "Production overview" })).toBeVisible();
  17 |     await expect(page.getByRole("heading", { name: "Recent runs" })).toBeVisible();
  18 |     await page.screenshot({ path: resolve(screenshots, `dashboard-${width}.png`), fullPage: true });
  19 |     const hasHorizontalOverflow = await page.locator("html").evaluate((element) => element.scrollWidth > window.innerWidth);
> 20 |     expect(hasHorizontalOverflow, `horizontal overflow at ${width}px`).toBe(false);
     |                                                                        ^ Error: horizontal overflow at 360px
  21 |   }
  22 |   const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  23 |   expect(accessibility.violations).toEqual([]);
  24 | });
  25 | 
  26 | test("incident and empty demo variants stay isolated from the API", async ({ page }) => {
  27 |   const apiRequests: string[] = [];
  28 |   page.on("request", (request) => {
  29 |     if (request.url().includes("/api/repos")) apiRequests.push(request.url());
  30 |   });
  31 |   await page.goto("/?demo=incident");
  32 |   await expect(page.getByText("Demo data")).toBeVisible();
  33 |   await expect(page.getByText(/Production incident open for/)).toBeVisible();
  34 |   await expect(page.getByText("production is affected · failing f09e81c")).toBeVisible();
  35 |   await page.goto("/?demo=empty");
  36 |   await expect(page.getByText("No data in this window").first()).toBeVisible();
  37 |   await expect(page.getByText("Your delivery data will appear here")).toBeVisible();
  38 |   expect(apiRequests).toEqual([]);
  39 | });
  40 | 
```
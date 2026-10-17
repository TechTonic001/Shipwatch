# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> demo dashboard is responsive and accessible
- Location: e2e\dashboard.spec.ts:10:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 47

- Array []
+ Array [
+   Object {
+     "description": "Ensure ARIA attributes are not prohibited for an element's role",
+     "help": "Elements must only use permitted ARIA attributes",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.14/aria-prohibited-attr?application=playwright",
+     "id": "aria-prohibited-attr",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [],
+         "failureSummary": "Fix all of the following:
+   aria-label attribute cannot be used on \"div\" elements with no valid role attribute.",
+         "html": "<div aria-label=\"Loading deployment chart\" class=\"skeleton h-80 rounded-console border border-border/70\"></div>",
+         "impact": "serious",
+         "none": Array [
+           Object {
+             "data": Object {
+               "messageKey": "noRoleSingular",
+               "nodeName": "div",
+               "prohibited": Array [
+                 "aria-label",
+               ],
+               "role": null,
+             },
+             "id": "aria-prohibited-attr",
+             "impact": "serious",
+             "message": "aria-label attribute cannot be used on \"div\" elements with no valid role attribute.",
+             "relatedNodes": Array [],
+           },
+         ],
+         "target": Array [
+           ".skeleton",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.aria",
+       "wcag2a",
+       "wcag412",
+       "EN-301-549",
+       "EN-9.4.1.2",
+       "RGAAv4",
+       "RGAA-7.1.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e3]:
    - banner [ref=f2e4]:
      - generic [ref=f2e5]:
        - generic [ref=f2e6]:
          - link "shipwatch" [ref=f2e7] [cursor=pointer]:
            - /url: "#dashboard"
            - generic [aria-hidden] [ref=f2e8]: S
          - generic [ref=f2e10]: Demo data
        - generic [ref=f2e11]:
          - generic [ref=f2e12]:
            - generic [aria-hidden] [ref=f2e13]: ⌘
            - generic [ref=f2e14]: Repository
            - combobox "Repository" [ref=f2e15]:
              - option "acme/shipwatch-api" [selected]
          - group "Metric window" [ref=f2e16]:
            - button "7d" [pressed] [ref=f2e17] [cursor=pointer]
            - button "30d" [ref=f2e18] [cursor=pointer]
          - generic "Live, refreshed 0s ago" [ref=f2e19]:
            - generic [ref=f2e21]: Live
            - generic [ref=f2e22]: · 0s ago
          - button "Sign out" [ref=f2e23] [cursor=pointer]
    - main [ref=f2e24]:
      - generic [ref=f2e25]:
        - generic [ref=f2e26]:
          - paragraph [ref=f2e27]: Delivery health
          - heading "Production overview" [level=1] [ref=f2e28]
        - paragraph [ref=f2e29]: Updated 0s ago
      - generic [ref=f2e30]:
        - generic [ref=f2e31]:
          - generic [aria-hidden] [ref=f2e32]: ✓
          - generic [ref=f2e33]:
            - paragraph [ref=f2e34]: All clear
            - paragraph [ref=f2e35]: Last deploy 12 min ago · abc1234
        - generic [ref=f2e36]: Healthy
      - region "Delivery metrics" [ref=f2e38]:
        - article [ref=f2e39]:
          - generic [ref=f2e40]:
            - heading "Deployment frequency" [level=2] [ref=f2e41]
            - button "Deployment frequency definition" [ref=f2e43] [cursor=pointer]: i
          - paragraph [ref=f2e44]: 1.1 / day
          - paragraph [ref=f2e45]: 8 successful deployments
        - article [ref=f2e54]:
          - generic [ref=f2e55]:
            - heading "Change failure rate" [level=2] [ref=f2e56]
            - button "Change failure rate definition" [ref=f2e58] [cursor=pointer]: i
          - paragraph [ref=f2e59]: 8.3%
          - paragraph [ref=f2e60]: 1 failed / 12 total
        - article [ref=f2e61]:
          - generic [ref=f2e62]:
            - heading "MTTR" [level=2] [ref=f2e63]
            - button "MTTR definition" [ref=f2e65] [cursor=pointer]: i
          - paragraph [ref=f2e66]: 31m
          - paragraph [ref=f2e67]: p90 72m · 4 resolved
      - region [ref=f2e68]:
        - generic [ref=f2e69]:
          - generic [ref=f2e70]:
            - heading "Deployments per day" [level=2] [ref=f2e71]
            - paragraph [ref=f2e72]: Successful production deployments
          - button "View as table" [ref=f2e73] [cursor=pointer]
        - img "Bar chart of successful production deployments by day" [ref=f2e74]:
          - generic [ref=f2e76]:
            - img [ref=f2e77]:
              - generic [ref=f2e81]:
                - generic [ref=f2e82]: 10-11
                - generic [ref=f2e84]: 10-12
                - generic [ref=f2e86]: 10-13
                - generic [ref=f2e88]: 10-14
                - generic [ref=f2e90]: 10-15
                - generic [ref=f2e92]: 10-16
                - generic [ref=f2e94]: 10-17
              - generic [ref=f2e97]:
                - generic [ref=f2e98]: "0"
                - generic [ref=f2e100]: "1"
                - generic [ref=f2e102]: "2"
                - generic [ref=f2e104]: "3"
                - generic [ref=f2e106]: "4"
            - list [ref=f2e109]:
              - listitem [ref=f2e110]: Successful
        - paragraph [ref=f2e113]: Failed deployment counts are not included in this API response.
      - generic [ref=f2e114]:
        - region [ref=f2e115]:
          - generic [ref=f2e116]:
            - heading "Recent incidents" [level=2] [ref=f2e117]
            - generic [ref=f2e118]: 0 total
          - paragraph [ref=f2e119]: No incidents recorded in this feed.
        - region [ref=f2e121]:
          - generic [ref=f2e122]:
            - heading "Recent runs" [level=2] [ref=f2e123]
            - generic [ref=f2e124]: 10 shown
          - table [ref=f2e126]:
            - caption [ref=f2e127]: Recent deployment runs
            - rowgroup [ref=f2e128]:
              - row [ref=f2e129]:
                - columnheader "Environment" [ref=f2e130]
                - columnheader "SHA" [ref=f2e131]
                - columnheader "Status" [ref=f2e132]
                - columnheader "Duration" [ref=f2e133]
                - columnheader "Started" [ref=f2e134]
            - rowgroup [ref=f2e135]:
              - row [ref=f2e136]:
                - cell "production" [ref=f2e137]
                - cell "abc1234" [ref=f2e138]
                - cell [ref=f2e139]:
                  - generic [ref=f2e140]:
                    - generic [aria-hidden] [ref=f2e141]: ✓
                    - text: Succeeded
                - cell "1m 0s" [ref=f2e142]
                - cell "12m ago" [ref=f2e143]
              - row [ref=f2e144]:
                - cell "production" [ref=f2e145]
                - cell "f09e81c" [ref=f2e146]
                - cell [ref=f2e147]:
                  - generic [ref=f2e148]:
                    - generic [aria-hidden] [ref=f2e149]: ×
                    - text: Failed
                - cell "1m 0s" [ref=f2e150]
                - cell "49m ago" [ref=f2e151]
              - row [ref=f2e152]:
                - cell "staging" [ref=f2e153]
                - cell "4b6c0e2" [ref=f2e154]
                - cell [ref=f2e155]:
                  - generic [ref=f2e156]:
                    - generic [aria-hidden] [ref=f2e157]: ✓
                    - text: Succeeded
                - cell "1m 0s" [ref=f2e158]
                - cell "1h ago" [ref=f2e159]
              - row [ref=f2e160]:
                - cell "production" [ref=f2e161]
                - cell "d8a214f" [ref=f2e162]
                - cell [ref=f2e163]:
                  - generic [ref=f2e164]:
                    - generic [aria-hidden] [ref=f2e165]: ✓
                    - text: Succeeded
                - cell "1m 0s" [ref=f2e166]
                - cell "2h ago" [ref=f2e167]
              - row [ref=f2e168]:
                - cell "production" [ref=f2e169]
                - cell "abc1234" [ref=f2e170]
                - cell [ref=f2e171]:
                  - generic [ref=f2e172]:
                    - generic [aria-hidden] [ref=f2e173]: ✓
                    - text: Succeeded
                - cell "1m 0s" [ref=f2e174]
                - cell "2h ago" [ref=f2e175]
              - row [ref=f2e176]:
                - cell "production" [ref=f2e177]
                - cell "f09e81c" [ref=f2e178]
                - cell [ref=f2e179]:
                  - generic [ref=f2e180]:
                    - generic [aria-hidden] [ref=f2e181]: ×
                    - text: Failed
                - cell "1m 0s" [ref=f2e182]
                - cell "3h ago" [ref=f2e183]
              - row [ref=f2e184]:
                - cell "staging" [ref=f2e185]
                - cell "4b6c0e2" [ref=f2e186]
                - cell [ref=f2e187]:
                  - generic [ref=f2e188]:
                    - generic [aria-hidden] [ref=f2e189]: ✓
                    - text: Succeeded
                - cell "1m 0s" [ref=f2e190]
                - cell "3h ago" [ref=f2e191]
              - row [ref=f2e192]:
                - cell "production" [ref=f2e193]
                - cell "d8a214f" [ref=f2e194]
                - cell [ref=f2e195]:
                  - generic [ref=f2e196]:
                    - generic [aria-hidden] [ref=f2e197]: ✓
                    - text: Succeeded
                - cell "1m 0s" [ref=f2e198]
                - cell "4h ago" [ref=f2e199]
              - row [ref=f2e200]:
                - cell "production" [ref=f2e201]
                - cell "abc1234" [ref=f2e202]
                - cell [ref=f2e203]:
                  - generic [ref=f2e204]:
                    - generic [aria-hidden] [ref=f2e205]: ✓
                    - text: Succeeded
                - cell "1m 0s" [ref=f2e206]
                - cell "5h ago" [ref=f2e207]
              - row [ref=f2e208]:
                - cell "production" [ref=f2e209]
                - cell "f09e81c" [ref=f2e210]
                - cell [ref=f2e211]:
                  - generic [ref=f2e212]:
                    - generic [aria-hidden] [ref=f2e213]: ×
                    - text: Failed
                - cell "1m 0s" [ref=f2e214]
                - cell "5h ago" [ref=f2e215]
          - button "Load more" [ref=f2e216] [cursor=pointer]
    - contentinfo [ref=f2e217]:
      - generic [ref=f2e218]:
        - generic [ref=f2e219]:
          - generic [ref=f2e220]:
            - text: Backend
            - code [ref=f2e221]: local
          - generic [ref=f2e222]:
            - text: Frontend
            - code [ref=f2e223]: local
        - link "Metric definitions" [ref=f2e224] [cursor=pointer]:
          - /url: /docs/metrics.md
  - generic [aria-hidden] [ref=f2e225]: "0"
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
  19 |     const dimensions = await page.locator("html").evaluate((element) => ({
  20 |       document: element.scrollWidth,
  21 |       viewport: window.innerWidth,
  22 |       offenders: Array.from(document.querySelectorAll("body *"))
  23 |         .filter((child) => child.getBoundingClientRect().right > window.innerWidth)
  24 |         .slice(0, 5)
  25 |         .map((child) => ({ tag: child.tagName, className: child.className, right: child.getBoundingClientRect().right }))
  26 |     }));
  27 |     expect(dimensions.document <= dimensions.viewport, `horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBe(true);
  28 |   }
  29 |   const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
> 30 |   expect(accessibility.violations).toEqual([]);
     |                                    ^ Error: expect(received).toEqual(expected) // deep equality
  31 |   await page.emulateMedia({ colorScheme: "light" });
  32 |   const lightAccessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  33 |   expect(lightAccessibility.violations).toEqual([]);
  34 | });
  35 | 
  36 | test("incident and empty demo variants stay isolated from the API", async ({ page }) => {
  37 |   const apiRequests: string[] = [];
  38 |   page.on("request", (request) => {
  39 |     if (request.url().includes("/api/repos")) apiRequests.push(request.url());
  40 |   });
  41 |   await page.goto("/?demo=incident");
  42 |   await expect(page.getByText("Demo data")).toBeVisible();
  43 |   await expect(page.getByText(/Production incident open for/)).toBeVisible();
  44 |   await expect(page.getByText("production is affected · latest failed SHA: f09e81c")).toBeVisible();
  45 |   await page.goto("/?demo=empty");
  46 |   await expect(page.getByText("No data in this window").first()).toBeVisible();
  47 |   await expect(page.getByText("Your delivery data will appear here")).toBeVisible();
  48 |   expect(apiRequests).toEqual([]);
  49 | });
  50 | 
```
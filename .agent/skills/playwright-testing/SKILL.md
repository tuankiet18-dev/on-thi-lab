---
name: playwright-testing
description: >-
  Use this skill when writing, debugging, or maintaining Playwright end-to-end (E2E)
  and integration tests. Covers reliable selector strategies, page object patterns,
  mocking network APIs, auto-waiting, visual regression, and test runner troubleshooting.
---

# Playwright Testing Skill

Comprehensive best practices for writing fast, resilient, and deterministic Playwright tests.

---

## 1. Core Principles

1. **User-Centric Selectors**:
   - Prefer role-based and accessible locators over brittle CSS or XPath selectors:
     ```ts
     // ✅ Good: User-facing locators
     page.getByRole("button", { name: /bắt đầu làm bài/i });
     page.getByLabel("Mã sinh viên");
     page.getByTestId("question-navigator");

     // ❌ Bad: Brittle DOM hierarchies
     page.locator("div.container > div:nth-child(2) > button");
     ```

2. **Leverage Auto-Waiting & Web-First Assertions**:
   - Never use arbitrary `page.waitForTimeout()`.
   - Use built-in web-first assertions that automatically poll until conditions are met:
     ```ts
     await expect(page.getByRole("dialog")).toBeVisible();
     await expect(page.getByTestId("score-display")).toHaveText("100/100");
     ```

3. **Isolate Test State & Mocking**:
   - Avoid inter-test dependencies. Each test must start from a clean state.
   - Use `page.route()` or mock auth tokens when testing frontend-isolated behavior:
     ```ts
     await page.route("**/api/v1/attempts/*", async (route) => {
       await route.fulfill({
         status: 200,
         contentType: "application/json",
         body: JSON.stringify({ id: "attempt-123", status: "IN_PROGRESS" }),
       });
     });
     ```

---

## 2. Common Patterns & Workflows

### E2E Flow Example (Exam Attempt Flow)

```ts
import { test, expect } from "@playwright/test";

test.describe("Exam Attempt Flow", () => {
  test("allows student to navigate questions and submit exam", async ({
    page,
  }) => {
    await page.goto("/catalog");

    // Select exam
    await page.getByRole("link", { name: /đề thi mẫu/i }).click();
    await page.getByRole("button", { name: /bắt đầu/i }).click();

    // Verify attempt screen
    await expect(page.getByTestId("question-card")).toBeVisible();

    // Answer questions
    await page.getByRole("radio", { name: /phương án a/i }).check();
    await page.getByRole("button", { name: /câu tiếp/i }).click();

    // Submit and review results
    await page.getByRole("button", { name: /nộp bài/i }).click();
    await page.getByRole("button", { name: /xác nhận nộp/i }).click();

    await expect(page).toHaveURL(/\/results\//);
    await expect(page.getByText(/kết quả làm bài/i)).toBeVisible();
  });
});
```

---

## 3. Running & Debugging Commands

```bash
# Run all E2E tests
pnpm test:e2e

# Run a specific test file with headed browser
npx playwright test e2e/onthilab.spec.ts --headed

# Run in UI mode for interactive step-through debugging
npx playwright test --ui

# View HTML test report
npx playwright show-report
```

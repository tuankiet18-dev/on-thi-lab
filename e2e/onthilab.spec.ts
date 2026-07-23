import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("login route renders a safe unconfigured state in CI", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Chào mừng bạn" }),
  ).toBeVisible();
  await expect(
    page.getByText("Chế độ đăng nhập chưa được cấu hình trong môi trường này."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tiếp tục với Google" }),
  ).toHaveCount(0);
});

test("short pages keep the footer at the viewport bottom", async ({ page }) => {
  await page.goto("/history");
  await expect(
    page.getByRole("heading", { name: "Lịch sử làm bài" }),
  ).toBeVisible();

  const footer = await page.locator("footer").boundingBox();
  const viewport = page.viewportSize();

  expect(footer).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(
    Math.abs(footer!.y + footer!.height - viewport!.height),
  ).toBeLessThanOrEqual(1);
});

test("desktop student can complete a practice exam", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Luyện đề thật, tự tin bước vào phòng thi.",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Bắt đầu luyện thi" }).click();
  await expect(page).toHaveURL(/\/exams$/);

  await page.getByPlaceholder("Tìm mã môn hoặc tên môn...").fill("SWD392");
  await page.getByRole("link", { name: "Chi tiết" }).click();
  await expect(page).toHaveURL(/\/exams\/demo-swd392-sp26-fe$/);
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await expect(page).toHaveURL(/\/attempts\/demo-attempt$/);

  await page.getByRole("radio", { name: /Đáp án B/ }).click();
  await page.getByRole("button", { name: "Câu tiếp" }).click();
  await page.getByRole("radio", { name: /Đáp án C/ }).click();
  await page.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Nộp bài" })
    .click();

  await expect(page).toHaveURL(/\/results\/demo-attempt$/);
  await expect(
    page.getByRole("heading", { name: "Kết quả thi thử SWD392" }),
  ).toBeVisible();
  await expect(page.getByText("4", { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("result.png"),
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
});

test("catalog is responsive without horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.goto("/exams");
  await expect(
    page.getByRole("heading", { name: "Kho đề thi FE" }),
  ).toBeVisible();

  const measurements = await page.locator("body").evaluate((body) => ({
    scrollWidth: body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(measurements.scrollWidth).toBeLessThanOrEqual(
    measurements.viewportWidth,
  );
  if (testInfo.project.name === "mobile-chromium") {
    await page.screenshot({
      path: testInfo.outputPath("catalog-mobile.png"),
      fullPage: true,
    });
  }
});

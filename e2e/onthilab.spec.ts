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
  await page.goto("/not-a-real-route");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy trang bạn yêu cầu" }),
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

  await page.getByRole("button", { name: "Phóng to ảnh câu 1" }).click();
  await expect(
    page.getByRole("dialog", { name: "Ảnh phóng to câu 1" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Ảnh phóng to câu 1" }),
  ).toHaveCount(0);

  await page.getByRole("radio", { name: "Chọn đáp án B" }).click();
  await page.getByRole("button", { name: "Câu tiếp" }).click();
  await page.getByRole("radio", { name: "Chọn đáp án C" }).click();
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

test("catalog is responsive without horizontal overflow", async ({ page }) => {
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
});

test("student can preview a published exam without starting an attempt", async ({
  page,
}) => {
  await page.goto("/exams/demo-swd392-sp26-fe/preview");

  await expect(
    page.getByRole("heading", {
      name: "Software Architecture and Design",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Câu hỏi về software modeling với bốn lựa chọn A đến D",
    }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByRole("button", { name: "Câu sau" }).click();
  await expect(
    page.getByRole("img", {
      name: "Câu hỏi về software design concept với bốn lựa chọn",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Bắt đầu thi thử" }),
  ).toBeVisible();
});

test("draft import form captures metadata and a ZIP archive", async ({
  page,
}) => {
  await page.goto("/admin/import");
  await expect(
    page.getByRole("heading", { name: "Tạo đề thi mới" }),
  ).toBeVisible();

  await page.getByLabel("Kỳ học").fill("SP26");
  await page.getByLabel("Chọn file ZIP chứa ảnh câu hỏi").setInputFiles({
    name: "questions.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK"),
  });

  const submit = page.getByRole("button", {
    name: "Kiểm tra và tạo đề nháp",
  });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("Bạn cần đăng nhập");
});

test("answer review route has a safe unauthenticated state", async ({
  page,
}) => {
  await page.goto("/admin/exams/20000000-0000-4000-8000-000000000001/review");
  await expect(
    page.getByRole("heading", { name: "Cần đăng nhập" }),
  ).toBeVisible();
  const measurements = await page.locator("body").evaluate((body) => ({
    scrollWidth: body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(measurements.scrollWidth).toBeLessThanOrEqual(
    measurements.viewportWidth,
  );
});

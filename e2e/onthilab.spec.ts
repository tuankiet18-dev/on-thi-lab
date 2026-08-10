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

test("feedback button opens an accessible dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Góp ý cho OnThiLab" }).click();
  await expect(
    page.getByRole("dialog", { name: "Góp ý cho OnThiLab" }),
  ).toBeVisible();
  await expect(page.getByLabel("Loại góp ý")).toBeVisible();
  await expect(page.getByLabel("Nội dung")).toBeVisible();
  await page.getByRole("button", { name: "Đóng góp ý" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
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
      name: "Ôn đúng môn. Vào đề ngay.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Đề mới", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Mở đề và bắt đầu" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  const courseSearch = page.getByRole("combobox", {
    name: "Tìm mã hoặc tên môn học",
  });
  await courseSearch.fill("SWD");
  await expect(
    page.getByRole("listbox", { name: "Kết quả tìm kiếm" }),
  ).toBeVisible();
  await courseSearch.press("ArrowDown");
  await expect(courseSearch).toHaveAttribute(
    "aria-activedescendant",
    "search-option-0",
  );
  await courseSearch.press("Enter");
  await expect(page).toHaveURL(/\/exams\/demo-swd392-sp26-fe$/);
  await expect(page.getByText("Tối đa 2 lượt/ngày")).toHaveCount(0);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
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
  await page.getByRole("button", { name: "Câu sau" }).click();
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
  await page.goto("/exams?q=SWD392");
  await expect(page.getByRole("heading", { name: "Kho đề" })).toBeVisible();
  await expect(page.getByPlaceholder("Tìm mã hoặc tên môn")).toHaveValue(
    "SWD392",
  );

  const measurements = await page.locator("body").evaluate((body) => ({
    scrollWidth: body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(measurements.scrollWidth).toBeLessThanOrEqual(
    measurements.viewportWidth,
  );
});

test("dashboard keeps the first action readable without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ôn đúng môn. Vào đề ngay." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Mở đề và bắt đầu" }),
  ).toBeVisible();

  const measurements = await page.locator("body").evaluate((body) => ({
    scrollWidth: body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(measurements.scrollWidth).toBeLessThanOrEqual(
    measurements.viewportWidth,
  );
});

test("mobile admin menu exposes all administration tools", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await page.goto("/");
  await page.getByRole("button", { name: "Mở menu" }).click();

  const navigation = page.getByRole("navigation", { name: "Di động" });
  await expect(navigation.getByText("Quản trị", { exact: true })).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Phân quyền" }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Quản lý báo cáo" }),
  ).toBeVisible();
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

test("draft import queues ZIP archives without prefilled metadata", async ({
  page,
}) => {
  await page.goto("/admin/import");
  await expect(
    page.getByRole("heading", { name: "Nhập đề thi" }),
  ).toBeVisible();

  await page.getByLabel("Chọn một hoặc nhiều file ZIP").setInputFiles([
    {
      name: "questions-1.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("PK"),
    },
    {
      name: "questions-2.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("PK"),
    },
  ]);

  await expect(page.getByText("questions-1.zip")).toBeVisible();
  await expect(page.getByText("questions-2.zip")).toBeVisible();
  await expect(
    page.getByText("2 ZIP · 0 đã tạo · 2 thiếu thông tin"),
  ).toBeVisible();

  const firstArchive = page.getByRole("article", {
    name: "ZIP 1: questions-1.zip",
  });
  await expect(firstArchive.getByLabel("Môn học")).toHaveValue("");
  await expect(firstArchive.getByLabel("Kỳ học")).toHaveValue("");
  await expect(firstArchive.getByLabel("Campus")).toHaveValue("");
  await expect(firstArchive.getByLabel("Thời gian (phút)")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Điền đủ thông tin" }),
  ).toBeDisabled();
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

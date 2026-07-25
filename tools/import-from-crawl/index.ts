/**
 * index.ts — CLI Pipeline: Import đề từ dữ liệu cào FuOverflow
 *
 * Sử dụng:
 *   npx tsx tools/import-from-crawl/index.ts \
 *     --images-dir /path/to/images \
 *     --answers-json /path/to/answers.json \
 *     --api-url http://localhost:8787 \
 *     --token <admin-id-token> \
 *     --course SWD392 \
 *     --semester SP26 \
 *     --campus HL \
 *     --exam-type FE \
 *     --duration 60 \
 *     [--dry-run]
 */

import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import {
  computeAllAnswers,
  letterToIndex,
  printAnswerSummary,
  type AnswerResult,
} from "./compute-answers.js";
import { packZip } from "./pack-zip.js";

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        result[key] = value;
        i++;
      } else {
        result[key] = "true"; // boolean flag
      }
    }
  }
  return result;
}

function requireArg(
  args: Record<string, string>,
  key: string,
  description: string,
): string {
  const val = args[key];
  if (!val) {
    console.error(`❌ Thiếu argument: --${key} (${description})`);
    process.exit(1);
  }
  return val;
}

// ─── API Client ──────────────────────────────────────────────────────────────

interface ApiClient {
  apiUrl: string;
  token: string;
}

async function apiRequest<T>(
  client: ApiClient,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${client.apiUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${client.token}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json()) as { data?: T; error?: string };
  if (!response.ok) {
    throw new Error(
      `API ${method} ${path} thất bại [${response.status}]: ${json.error ?? "Unknown error"}`,
    );
  }
  return json.data as T;
}

async function uploadToS3(uploadUrl: string, zipPath: string): Promise<void> {
  const fileData = await readFile(zipPath);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: fileData,
    headers: { "Content-Type": "application/zip" },
  });
  if (!response.ok) {
    throw new Error(`Upload S3 thất bại [${response.status}]`);
  }
}

// ─── Report Types ────────────────────────────────────────────────────────────

interface DisputedQuestionReport {
  questionNumber: number;
  topAnswers: Record<string, number>;
  reason: string;
  reviewUrl: string;
}

interface ImportReport {
  examId: string;
  revisionId: string;
  examCode: string;
  totalQuestions: number;
  autoFilledCount: number;
  pendingReviewCount: number;
  pendingReview: DisputedQuestionReport[];
  generatedAt: string;
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const isDryRun = args["dry-run"] === "true";
  const imagesDir = requireArg(args, "images-dir", "Thư mục chứa ảnh Q1..Q60");
  const answersJsonPath = requireArg(
    args,
    "answers-json",
    "Đường dẫn file answers.json",
  );
  const courseCode = requireArg(args, "course", "Mã môn học, VD: SWD392");
  const semester = requireArg(args, "semester", "Học kỳ, VD: SP26");
  const campusCode = requireArg(args, "campus", "Mã campus, VD: HL");
  const examType = requireArg(args, "exam-type", "Loại đề: FE hoặc PE");
  const durationMinutes = parseInt(args["duration"] ?? "60", 10);

  const apiUrl = isDryRun ? "" : requireArg(args, "api-url", "URL API backend");
  const token = isDryRun
    ? ""
    : requireArg(args, "token", "Admin Cognito ID token");
  const isRetake = args["retake"] === "true";

  console.log("=".repeat(60));
  console.log("🚀 ONTHILAB — Import từ dữ liệu cào FuOverflow");
  console.log("=".repeat(60));
  console.log(`📂 Ảnh: ${imagesDir}`);
  console.log(`📋 Đáp án: ${answersJsonPath}`);
  console.log(`📝 Đề: ${courseCode} - ${semester} - ${campusCode} - ${examType}`);
  console.log(`⏱️  Thời gian: ${durationMinutes} phút`);
  if (isDryRun) console.log(`🔍 CHẾ ĐỘ DRY-RUN (không gọi API)`);
  console.log("");

  // ── Step 1: Đọc và tính đáp án ──────────────────────────────────────────
  console.log("Step 1: Tính đáp án bằng majority voting...");
  const answersRaw = JSON.parse(await readFile(answersJsonPath, "utf-8")) as Record<
    string,
    Array<{ author: string; content: string }>
  >;

  const answerResults = computeAllAnswers(answersRaw);
  printAnswerSummary(answerResults);

  const disputed = answerResults.filter((r) => r.disputed);
  const autoFill = answerResults.filter((r) => !r.disputed);

  if (isDryRun) {
    console.log("✅ Dry-run hoàn tất. Không có thay đổi nào được thực hiện.");
    process.exit(0);
  }

  // ── Step 2: Pack ZIP ─────────────────────────────────────────────────────
  console.log("Step 2: Đóng gói ảnh thành ZIP...");
  const tempDir = join(tmpdir(), `onthilab-import-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });
  const zipPath = join(tempDir, "questions.zip");

  try {
    await packZip({
      imageDir: imagesDir,
      outputPath: zipPath,
      expectedCount: 60,
    });

    const client: ApiClient = { apiUrl, token };

    // ── Step 3: Lấy presigned URL ──────────────────────────────────────────
    console.log("\nStep 3: Lấy presigned S3 URL...");
    const { uploadUrl, key } = await apiRequest<{
      uploadUrl: string;
      key: string;
    }>(client, "POST", "/v1/admin/imports/presign");
    console.log(`✅ Presigned key: ${key}`);

    // ── Step 4: Upload ZIP lên S3 ──────────────────────────────────────────
    console.log("\nStep 4: Upload ZIP lên S3...");
    await uploadToS3(uploadUrl, zipPath);
    console.log("✅ Upload thành công");

    // ── Step 5: Tạo draft ──────────────────────────────────────────────────
    console.log("\nStep 5: Tạo draft exam...");
    const draft = await apiRequest<{
      examId: string;
      revisionId: string;
      examCode: string;
      questionCount: number;
    }>(client, "POST", "/v1/admin/imports", {
      metadata: {
        courseCode,
        semester,
        campusCode,
        examType: examType.toUpperCase(),
        isRetake,
        durationMinutes,
      },
      archiveKey: key,
    });
    console.log(
      `✅ Draft tạo thành công: ${draft.examCode} (examId: ${draft.examId})`,
    );

    // ── Step 6: Lấy danh sách questionId theo thứ tự ──────────────────────
    console.log("\nStep 6: Lấy danh sách câu hỏi...");
    const review = await apiRequest<{
      questions: Array<{ id: string; order: number }>;
    }>(client, "GET", `/v1/admin/exams/${draft.examId}/review`);

    // Map order → questionId
    const orderToId = new Map<number, string>();
    for (const q of review.questions) {
      orderToId.set(q.order, q.id);
    }
    console.log(`✅ Lấy được ${review.questions.length} câu hỏi`);

    // ── Step 7: Auto-fill đáp án không tranh luận ──────────────────────────
    console.log(
      `\nStep 7: Auto-fill ${autoFill.length} đáp án không tranh luận...`,
    );
    let filledCount = 0;
    let errorCount = 0;

    for (const result of autoFill) {
      const questionId = orderToId.get(result.questionNumber);
      if (!questionId) {
        console.warn(
          `  ⚠️  Không tìm thấy questionId cho câu Q${result.questionNumber}`,
        );
        errorCount++;
        continue;
      }

      try {
        await apiRequest(
          client,
          "PUT",
          `/v1/admin/exams/${draft.examId}/questions/${questionId}/answer`,
          {
            type: "single",
            optionCount: 4,
            correctOptions: [letterToIndex(result.answer)],
          },
        );
        filledCount++;
        process.stdout.write(
          `  ✅ Q${result.questionNumber} = ${result.answer.toUpperCase()}\n`,
        );
      } catch (err) {
        console.error(
          `  ❌ Lỗi khi điền Q${result.questionNumber}: ${err instanceof Error ? err.message : String(err)}`,
        );
        errorCount++;
      }
    }

    console.log(
      `\n✅ Đã điền: ${filledCount}/${autoFill.length} câu (lỗi: ${errorCount})`,
    );

    // ── Step 8: Tạo report ─────────────────────────────────────────────────
    const webUrl = apiUrl.replace(":8787", ":5173");
    const report: ImportReport = {
      examId: draft.examId,
      revisionId: draft.revisionId,
      examCode: draft.examCode,
      totalQuestions: draft.questionCount,
      autoFilledCount: filledCount,
      pendingReviewCount: disputed.length,
      pendingReview: disputed.map((r) => ({
        questionNumber: r.questionNumber,
        topAnswers: Object.fromEntries(
          Object.entries(r.voteBreakdown).filter(([, v]) => v > 0),
        ),
        reason: r.disputeReason ?? "",
        reviewUrl: `${webUrl}/admin/review/${draft.examId}`,
      })),
      generatedAt: new Date().toISOString(),
    };

    const reportPath = `import-report-${draft.examCode}-${Date.now()}.json`;
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");

    console.log("\n" + "=".repeat(60));
    console.log("🎉 IMPORT HOÀN TẤT!");
    console.log("=".repeat(60));
    console.log(`📄 Mã đề: ${draft.examCode}`);
    console.log(`🆔 Exam ID: ${draft.examId}`);
    console.log(`✅ Đã điền tự động: ${filledCount} câu`);
    console.log(`⚠️  Cần review thủ công: ${disputed.length} câu`);

    if (disputed.length > 0) {
      console.log("\n📌 Câu cần review thủ công:");
      for (const r of disputed) {
        const breakdown = Object.entries(r.voteBreakdown)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k.toUpperCase()}:${v}`)
          .join(", ");
        console.log(`  Q${r.questionNumber}: ${r.disputeReason} [${breakdown}]`);
      }
      console.log(`\n🔗 Link review: ${webUrl}/admin/review/${draft.examId}`);
    }

    console.log(`\n📊 Report đầy đủ: ${reportPath}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("\n❌ Lỗi không xử lý được:", err);
  process.exit(1);
});

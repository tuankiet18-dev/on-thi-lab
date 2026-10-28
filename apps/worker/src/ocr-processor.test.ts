import type { PostgresOcrRepository } from "@onthilab/database";
import { describe, expect, it, vi } from "vitest";
import { processOcrJob, type TextOcrResult } from "./ocr-processor.js";

const questionId = "10000000-0000-4000-8000-000000000001";
const revisionId = "20000000-0000-4000-8000-000000000002";

const job = {
  questionId,
  revisionId,
  imageKey: "drafts/example/Q1.jpg",
  imageHash: "image-hash",
  providerVersion: "tesseract-paddle@2026-10",
};

const approved: TextOcrResult = {
  status: "approved",
  textContent: "What is the capital of France?",
  options: ["Paris", "London"],
  flagReasons: [],
  confidence: 1,
};

function repository(overrides: Record<string, unknown> = {}) {
  return {
    claimOcrJob: vi.fn(async () => true),
    isOcrJobActive: vi.fn(async () => true),
    findCachedOcrByHash: vi.fn(async () => null),
    saveOcrResult: vi.fn(async () => undefined),
    markOcrFailed: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as PostgresOcrRepository & {
    saveOcrResult: ReturnType<typeof vi.fn>;
    markOcrFailed: ReturnType<typeof vi.fn>;
  };
}

describe("processOcrJob", () => {
  it("saves approved text from the OCR result", async () => {
    const repo = repository();
    const ocr = { read: vi.fn(async () => approved) };

    await processOcrJob(job, { repository: repo, ocr });

    expect(ocr.read).toHaveBeenCalledWith(job.imageKey);
    expect(repo.saveOcrResult).toHaveBeenCalledWith(
      questionId,
      expect.objectContaining({
        textContent: approved.textContent,
        options: approved.options,
        status: "approved",
        providerVersion: "tesseract-paddle@2026-10",
      }),
    );
  });

  it("keeps a needs_review result as review, never as approved text", async () => {
    const repo = repository();
    const ocr = {
      read: vi.fn(async () => ({
        ...approved,
        status: "needs_review" as const,
        flagReasons: ["field_disagreement"],
        confidence: 0,
      })),
    };

    await processOcrJob(job, { repository: repo, ocr });

    expect(repo.saveOcrResult).toHaveBeenCalledWith(
      questionId,
      expect.objectContaining({
        status: "needs_review",
        flagReasons: ["field_disagreement"],
      }),
    );
  });

  it("does not call OCR for a stale job", async () => {
    const repo = repository({ claimOcrJob: vi.fn(async () => false) });
    const ocr = { read: vi.fn() };

    await processOcrJob(job, { repository: repo, ocr });

    expect(ocr.read).not.toHaveBeenCalled();
  });

  it("does not call OCR when the revision switched back to images", async () => {
    const repo = repository({ isOcrJobActive: vi.fn(async () => false) });
    const ocr = { read: vi.fn() };

    await processOcrJob(job, { repository: repo, ocr });

    expect(ocr.read).not.toHaveBeenCalled();
    expect(repo.saveOcrResult).not.toHaveBeenCalled();
  });

  it("reuses a cached result for the same image without calling OCR", async () => {
    const cached = { ...approved, providerVersion: job.providerVersion };
    const repo = repository({ findCachedOcrByHash: vi.fn(async () => cached) });
    const ocr = { read: vi.fn() };

    await processOcrJob(job, { repository: repo, ocr });

    expect(ocr.read).not.toHaveBeenCalled();
    expect(repo.saveOcrResult).toHaveBeenCalledWith(questionId, cached);
  });

  it("marks the job failed and rethrows when OCR throws, saving no text", async () => {
    const repo = repository();
    const ocr = {
      read: vi.fn(async () => {
        throw new Error("invoke timed out");
      }),
    };

    await expect(processOcrJob(job, { repository: repo, ocr })).rejects.toThrow(
      "invoke timed out",
    );

    expect(repo.markOcrFailed).toHaveBeenCalledWith(
      questionId,
      "invoke timed out",
    );
    expect(repo.saveOcrResult).not.toHaveBeenCalled();
  });

  it("accepts the new providerVersion and the old Textract ones", async () => {
    for (const providerVersion of [
      "tesseract-paddle@2026-10",
      "textract@2024-04-standard",
    ]) {
      const repo = repository();
      await processOcrJob(
        { ...job, providerVersion },
        { repository: repo, ocr: { read: async () => approved } },
      );
      expect(repo.saveOcrResult).toHaveBeenCalledOnce();
    }
  });
});

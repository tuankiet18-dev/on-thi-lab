import { describe, expect, it } from "vitest";
import { OCR_STALE_PROCESSING_MS, isOcrClaimable } from "./ocr-repository";

const now = new Date("2026-10-06T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("isOcrClaimable", () => {
  it("claims pending jobs", () => {
    expect(isOcrClaimable({ status: "pending" }, now)).toBe(true);
  });

  it("rejects jobs that are already finished or failed", () => {
    for (const status of ["approved", "needs_review", "failed"] as const) {
      expect(isOcrClaimable({ status }, now)).toBe(false);
    }
    expect(isOcrClaimable(null, now)).toBe(false);
    expect(isOcrClaimable(undefined, now)).toBe(false);
  });

  it("does not steal a processing job a live worker may still own", () => {
    expect(
      isOcrClaimable(
        { status: "processing", startedAt: ago(OCR_STALE_PROCESSING_MS - 1) },
        now,
      ),
    ).toBe(false);
  });

  it("reclaims a processing job left behind by a timed-out worker", () => {
    expect(
      isOcrClaimable(
        { status: "processing", startedAt: ago(OCR_STALE_PROCESSING_MS) },
        now,
      ),
    ).toBe(true);
  });

  it("treats processing without a readable start time as stale", () => {
    expect(isOcrClaimable({ status: "processing" }, now)).toBe(true);
    expect(
      isOcrClaimable({ status: "processing", startedAt: "not-a-date" }, now),
    ).toBe(true);
  });

  it("stays above the worker timeout and below the queue visibility timeout", () => {
    expect(OCR_STALE_PROCESSING_MS).toBeGreaterThan(120_000);
    expect(OCR_STALE_PROCESSING_MS).toBeLessThan(180_000);
  });
});

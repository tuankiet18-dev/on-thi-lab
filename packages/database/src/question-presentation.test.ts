import { describe, expect, it } from "vitest";
import {
  resolveQuestionContentMode,
  type ExamPresentationMode,
} from "./question-presentation.js";

type OcrMetadata = Parameters<typeof resolveQuestionContentMode>[1];

function resolve(mode: ExamPresentationMode, metadata: OcrMetadata) {
  return resolveQuestionContentMode(mode, metadata);
}

describe("resolveQuestionContentMode", () => {
  const usableText: OcrMetadata = {
    status: "approved",
    textContent: "Which option is correct?",
    options: ["First", "Second", "Third", "Fourth"],
  };

  it("uses text only for a complete approved OCR result in hybrid mode", () => {
    expect(resolve("hybrid", usableText)).toBe("text");
  });

  it("falls back to the original image for flagged or incomplete OCR", () => {
    expect(
      resolve("hybrid", {
        ...usableText,
        status: "needs_review",
        flagReasons: ["missing_option_labels"],
      }),
    ).toBe("image");
    expect(resolve("hybrid", { ...usableText, options: ["Only one"] })).toBe(
      "image",
    );
  });

  it("honours an admin per-question override", () => {
    expect(resolve("hybrid", { ...usableText, contentMode: "image" })).toBe(
      "image",
    );
  });

  it("keeps the explicit whole-exam modes deterministic", () => {
    expect(resolve("image", usableText)).toBe("image");
    expect(resolve("text", { status: "needs_review" })).toBe("text");
  });
});

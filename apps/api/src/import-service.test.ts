import { describe, expect, it } from "vitest";
import { draftQuestionsFromImages } from "./import-service";

const image = {
  order: 1,
  originalFileName: "question.webp",
  fileName: "Q1.webp",
  bytes: 1_024,
  sha256: "a".repeat(64),
};

describe("draftQuestionsFromImages", () => {
  it("saves trusted crawled answers and OCR option counts during import", () => {
    const [question] = draftQuestionsFromImages([image], "drafts/example", {
      "question.webp": [
        {
          content: "B",
          optionCount: 2,
          optionCountConfidence: 0.97,
          optionCountSource: "ocr",
          optionCountNeedsReview: false,
        },
      ],
    });

    expect(question).toMatchObject({
      type: "single",
      optionCount: 2,
      correctOptions: [1],
      aiMetadata: {
        status: "confirmed",
        provider: "community-comments",
        optionCount: 2,
        optionCountConfidence: 0.97,
        optionCountSource: "ocr",
        proposedAnswers: [1],
        requiresReview: false,
      },
    });
  });

  it("prefills but does not approve answers with uncertain OCR", () => {
    const [question] = draftQuestionsFromImages([image], "drafts/example", {
      "question.webp": [
        {
          content: "A",
          optionCount: 4,
          optionCountConfidence: 0.61,
          optionCountSource: "ocr",
          optionCountNeedsReview: true,
        },
      ],
    });

    expect(question).toMatchObject({
      type: "single",
      optionCount: 4,
      aiMetadata: {
        status: "suggested",
        proposedAnswers: [0],
        requiresReview: true,
      },
    });
    expect(question?.correctOptions).toBeUndefined();
  });

  it("does not auto-save a consensus answer without OCR option metadata", () => {
    const [question] = draftQuestionsFromImages([image], "drafts/example", {
      "question.webp": [{ content: "A" }],
    });

    expect(question).toMatchObject({
      optionCount: 4,
      aiMetadata: {
        status: "suggested",
        proposedAnswers: [0],
        requiresReview: false,
      },
    });
    expect(question?.correctOptions).toBeUndefined();
  });
});

import type { AiSuggestionRepository } from "@onthilab/database";
import { describe, expect, it, vi } from "vitest";
import { processAnswerSuggestionJob } from "./answer-suggestion";

const job = {
  examId: "20000000-0000-4000-8000-000000000001",
  questionId: "40000000-0000-4000-8000-000000000001",
  imageKey: "drafts/example/Q1.jpg",
  courseCode: "SWD392",
  optionCount: 4,
};

function createRepository(): AiSuggestionRepository {
  return {
    queueUnanswered: vi.fn(),
    queueQuestion: vi.fn(),
    markProcessing: vi.fn(),
    saveSuggestion: vi.fn(),
    markFailed: vi.fn(),
  };
}

describe("AI answer suggestion job", () => {
  it("stores an untrusted proposal without writing the official answer", async () => {
    const repository = createRepository();
    await processAnswerSuggestionJob(job, {
      repository,
      images: {
        read: async () => ({
          bytes: new Uint8Array([255, 216, 255]),
          contentType: "image/jpeg",
        }),
      },
      provider: {
        providerName: "test-provider",
        model: "vision-test",
        proposeAnswer: async () => ({
          questionType: "single",
          optionCount: 4,
          proposedAnswers: [1],
          confidence: 0.84,
        }),
      },
    });

    expect(repository.markProcessing).toHaveBeenCalledWith(job.questionId);
    expect(repository.saveSuggestion).toHaveBeenCalledWith(job.questionId, {
      proposedType: "single",
      optionCount: 4,
      proposedAnswers: [1],
      confidence: 0.84,
      provider: "test-provider",
      model: "vision-test",
      rationale: undefined,
    });
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("records failures so an admin can retry them", async () => {
    const repository = createRepository();
    await expect(
      processAnswerSuggestionJob(job, {
        repository,
        images: { read: async () => null },
        provider: {
          providerName: "test-provider",
          model: "vision-test",
          proposeAnswer: vi.fn(),
        },
      }),
    ).rejects.toThrow("Không thể đọc ảnh câu hỏi");

    expect(repository.markFailed).toHaveBeenCalledWith(
      job.questionId,
      "Không thể đọc ảnh câu hỏi.",
    );
    expect(repository.saveSuggestion).not.toHaveBeenCalled();
  });
});

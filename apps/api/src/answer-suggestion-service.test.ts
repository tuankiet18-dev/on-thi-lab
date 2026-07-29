import type {
  AiSuggestionJob,
  AiSuggestionRepository,
} from "@onthilab/database";
import type {
  AiVisionProvider,
  AnswerSuggestionImageReader,
} from "@onthilab/worker";
import { describe, expect, it, vi } from "vitest";
import { LocalAsyncAnswerSuggestionService } from "./answer-suggestion-service";

describe("LocalAsyncAnswerSuggestionService", () => {
  it("reads and sends only the requested question to the AI provider", async () => {
    const examId = "20000000-0000-4000-8000-000000000001";
    const questionId = "40000000-0000-4000-8000-000000000001";
    const job: AiSuggestionJob = {
      examId,
      questionId,
      imageKey: "drafts/exam/current.webp",
      courseCode: "SWD392",
      optionCount: 4,
    };
    const readKeys: string[] = [];
    const savedQuestionIds: string[] = [];

    const repository: AiSuggestionRepository = {
      queueUnanswered: async () => {
        throw new Error("The whole exam must not be queued");
      },
      queueQuestion: async (inputExamId, inputQuestionId) => {
        expect(inputExamId).toBe(examId);
        expect(inputQuestionId).toBe(questionId);
        return { jobs: [job], skippedCount: 0 };
      },
      markProcessing: async () => undefined,
      saveSuggestion: async (inputQuestionId) => {
        savedQuestionIds.push(inputQuestionId);
      },
      markFailed: async () => undefined,
    };
    const images: AnswerSuggestionImageReader = {
      read: async (imageKey) => {
        readKeys.push(imageKey);
        return {
          bytes: new Uint8Array([1, 2, 3]),
          contentType: "image/webp",
        };
      },
    };
    const provider: AiVisionProvider = {
      providerName: "test",
      model: "vision-test",
      proposeAnswer: vi.fn(async () => ({
        questionType: "single" as const,
        optionCount: 4,
        proposedAnswers: [1],
        confidence: 0.9,
      })),
    };
    const service = new LocalAsyncAnswerSuggestionService(
      repository,
      images,
      provider,
      1,
    );

    await expect(service.queueQuestion(examId, questionId)).resolves.toEqual({
      examId,
      queuedCount: 1,
      skippedCount: 0,
    });

    expect(savedQuestionIds).toEqual([questionId]);
    expect(readKeys).toEqual(["drafts/exam/current.webp"]);
    expect(provider.proposeAnswer).toHaveBeenCalledTimes(1);
  });
});

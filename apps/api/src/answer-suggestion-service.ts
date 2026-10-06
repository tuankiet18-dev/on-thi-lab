import type {
  AiSuggestionJob,
  AiSuggestionRepository,
} from "@onthilab/database";
import {
  processAnswerSuggestionJob,
  type AiVisionProvider,
  type AnswerSuggestionImageReader,
} from "@onthilab/importer";
import type { QueueAiSuggestionsResult } from "@onthilab/contracts";

export type AnswerSuggestionServiceErrorCode = "AI_NOT_CONFIGURED";

export class AnswerSuggestionServiceError extends Error {
  constructor(
    readonly code: AnswerSuggestionServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AnswerSuggestionServiceError";
  }
}

export interface AnswerSuggestionService {
  queueQuestion(
    examId: string,
    questionId: string,
  ): Promise<QueueAiSuggestionsResult>;
}

export class UnconfiguredAnswerSuggestionService implements AnswerSuggestionService {
  async queueQuestion(): Promise<QueueAiSuggestionsResult> {
    throw new AnswerSuggestionServiceError(
      "AI_NOT_CONFIGURED",
      "Dịch vụ gợi ý AI chưa được cấu hình.",
    );
  }
}

async function runWithConcurrency(
  jobs: AiSuggestionJob[],
  concurrency: number,
  execute: (job: AiSuggestionJob) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, jobs.length) },
    async () => {
      while (nextIndex < jobs.length) {
        const job = jobs[nextIndex];
        nextIndex += 1;
        if (!job) return;
        await execute(job).catch(() => undefined);
      }
    },
  );
  await Promise.all(workers);
}

export class LocalAsyncAnswerSuggestionService implements AnswerSuggestionService {
  constructor(
    private readonly repository: AiSuggestionRepository,
    private readonly images: AnswerSuggestionImageReader,
    private readonly provider: AiVisionProvider,
    private readonly concurrency = 2,
  ) {}

  async queueQuestion(
    examId: string,
    questionId: string,
  ): Promise<QueueAiSuggestionsResult> {
    const queued = await this.repository.queueQuestion(examId, questionId);
    // A single-question request is used by the review screen and must finish
    // before a Lambda invocation returns. Work scheduled after the response
    // may be frozen by the Lambda runtime before the suggestion is persisted.
    await this.process(queued.jobs);

    return {
      examId,
      queuedCount: queued.jobs.length,
      skippedCount: queued.skippedCount,
    };
  }

  private process(jobs: AiSuggestionJob[]): Promise<void> {
    return runWithConcurrency(jobs, this.concurrency, async (job) =>
      processAnswerSuggestionJob(job, {
        repository: this.repository,
        images: this.images,
        provider: this.provider,
      }),
    );
  }
}

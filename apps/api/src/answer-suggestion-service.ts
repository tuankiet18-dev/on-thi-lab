import {
  SendMessageBatchCommand,
  SQSClient,
  type SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";
import type {
  AiSuggestionJob,
  AiSuggestionRepository,
} from "@onthilab/database";
import {
  processAnswerSuggestionJob,
  type AiVisionProvider,
  type AnswerSuggestionImageReader,
} from "@onthilab/worker";
import type { QueueAiSuggestionsResult } from "@onthilab/contracts";

export type AnswerSuggestionServiceErrorCode =
  "AI_NOT_CONFIGURED" | "QUEUE_FAILED";

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
  queueExam(examId: string): Promise<QueueAiSuggestionsResult>;
  queueQuestion(
    examId: string,
    questionId: string,
  ): Promise<QueueAiSuggestionsResult>;
}

export class UnconfiguredAnswerSuggestionService implements AnswerSuggestionService {
  async queueExam(): Promise<QueueAiSuggestionsResult> {
    throw new AnswerSuggestionServiceError(
      "AI_NOT_CONFIGURED",
      "Dịch vụ gợi ý AI chưa được cấu hình.",
    );
  }

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

  async queueExam(examId: string): Promise<QueueAiSuggestionsResult> {
    const queued = await this.repository.queueUnanswered(examId);
    this.process(queued.jobs);

    return {
      examId,
      queuedCount: queued.jobs.length,
      skippedCount: queued.skippedCount,
    };
  }

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

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export class SqsAnswerSuggestionService implements AnswerSuggestionService {
  constructor(
    private readonly repository: AiSuggestionRepository,
    private readonly queueUrl: string,
    private readonly client = new SQSClient({}),
  ) {}

  async queueExam(examId: string): Promise<QueueAiSuggestionsResult> {
    const queued = await this.repository.queueUnanswered(examId);
    return this.publish(examId, queued);
  }

  async queueQuestion(
    examId: string,
    questionId: string,
  ): Promise<QueueAiSuggestionsResult> {
    const queued = await this.repository.queueQuestion(examId, questionId);
    return this.publish(examId, queued);
  }

  private async publish(
    examId: string,
    queued: { jobs: AiSuggestionJob[]; skippedCount: number },
  ): Promise<QueueAiSuggestionsResult> {
    const publishedQuestionIds = new Set<string>();

    try {
      for (const batch of chunks(queued.jobs, 10)) {
        const entries: SendMessageBatchRequestEntry[] = batch.map(
          (job, index) => ({
            Id: `${index}-${job.questionId}`,
            MessageBody: JSON.stringify(job),
          }),
        );
        const response = await this.client.send(
          new SendMessageBatchCommand({
            QueueUrl: this.queueUrl,
            Entries: entries,
          }),
        );
        if (response.Failed?.length) {
          const failedIds = new Set(response.Failed.map((item) => item.Id));
          await Promise.all(
            batch
              .filter((_job, index) =>
                failedIds.has(`${index}-${batch[index]?.questionId}`),
              )
              .map((job) =>
                this.repository.markFailed(
                  job.questionId,
                  "Không thể đưa câu hỏi vào hàng đợi AI.",
                ),
              ),
          );
          throw new AnswerSuggestionServiceError(
            "QUEUE_FAILED",
            "Một số câu hỏi không thể đưa vào hàng đợi AI.",
          );
        }
        for (const job of batch) publishedQuestionIds.add(job.questionId);
      }
    } catch (error) {
      if (error instanceof AnswerSuggestionServiceError) throw error;
      await Promise.all(
        queued.jobs
          .filter((job) => !publishedQuestionIds.has(job.questionId))
          .map((job) =>
            this.repository.markFailed(
              job.questionId,
              "Không thể kết nối hàng đợi AI.",
            ),
          ),
      );
      throw new AnswerSuggestionServiceError(
        "QUEUE_FAILED",
        "Không thể kết nối hàng đợi AI.",
      );
    }

    return {
      examId,
      queuedCount: queued.jobs.length,
      skippedCount: queued.skippedCount,
    };
  }
}

import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import type { PostgresOcrRepository } from "@onthilab/database";
import { randomUUID } from "node:crypto";

export interface OcrService {
  enqueueRevisionOcrJobs(revisionId: string): Promise<void>;
  retryRevisionOcrJobs(revisionId: string): Promise<void>;
  enqueueQuestionOcrJob(questionId: string): Promise<void>;
}

export class UnconfiguredOcrService implements OcrService {
  async enqueueRevisionOcrJobs(): Promise<void> {
    throw new Error("OCR service not configured");
  }
  async retryRevisionOcrJobs(): Promise<void> {
    throw new Error("OCR service not configured");
  }
  async enqueueQuestionOcrJob(): Promise<void> {
    throw new Error("OCR service not configured");
  }
}

export class SqsOcrService implements OcrService {
  constructor(
    private readonly repository: PostgresOcrRepository,
    private readonly queueUrl: string,
    private readonly client = new SQSClient({}),
  ) {}

  async enqueueRevisionOcrJobs(revisionId: string): Promise<void> {
    const questionsList = await this.repository.enqueueOcrJobs(revisionId);
    await this.sendJobs(revisionId, questionsList, false);
  }

  async retryRevisionOcrJobs(revisionId: string): Promise<void> {
    const questionsList =
      await this.repository.resetRevisionOcrJobs(revisionId);
    await this.sendJobs(revisionId, questionsList, true);
  }

  private async sendJobs(
    revisionId: string,
    questionsList: { id: string; imageKey: string; imageHash: string }[],
    force: boolean,
  ): Promise<void> {
    if (questionsList.length === 0) return;

    // Send in batches of 10
    const batches = [];
    for (let i = 0; i < questionsList.length; i += 10) {
      batches.push(questionsList.slice(i, i + 10));
    }

    for (const batch of batches) {
      const response = await this.client.send(
        new SendMessageBatchCommand({
          QueueUrl: this.queueUrl,
          Entries: batch.map((q: any) => ({
            Id: randomUUID(), // ID for the batch entry
            MessageBody: JSON.stringify({
              questionId: q.id,
              revisionId: revisionId,
              imageKey: q.imageKey,
              imageHash: q.imageHash,
              providerVersion: "textract@2024-03-layout",
              force,
            }),
          })),
        }),
      );
      if ((response.Failed?.length ?? 0) > 0) {
        throw new Error("Không thể đưa một số câu hỏi vào hàng đợi OCR.");
      }
    }
  }

  async enqueueQuestionOcrJob(questionId: string): Promise<void> {
    const question = await this.repository.triggerReOcr(questionId);

    const response = await this.client.send(
      new SendMessageBatchCommand({
        QueueUrl: this.queueUrl,
        Entries: [
          {
            Id: randomUUID(),
            MessageBody: JSON.stringify({
              questionId: question.id,
              revisionId: question.revisionId,
              imageKey: question.imageKey,
              imageHash: question.imageHash,
              providerVersion: "textract@2024-03-layout",
              force: true,
            }),
          },
        ],
      }),
    );
    if ((response.Failed?.length ?? 0) > 0) {
      throw new Error("Không thể đưa câu hỏi vào hàng đợi OCR.");
    }
  }
}

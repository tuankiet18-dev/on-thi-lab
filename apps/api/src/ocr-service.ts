import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import type { PostgresOcrRepository } from "@onthilab/database";
import { randomUUID } from "node:crypto";

export interface OcrService {
  enqueueRevisionOcrJobs(revisionId: string): Promise<void>;
  enqueueQuestionOcrJob(questionId: string): Promise<void>;
}

export class UnconfiguredOcrService implements OcrService {
  async enqueueRevisionOcrJobs(): Promise<void> {
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

    // We need imageKey and imageHash for the OCR job.
    if (questionsList.length === 0) return;

    // Send in batches of 10
    const batches = [];
    for (let i = 0; i < questionsList.length; i += 10) {
      batches.push(questionsList.slice(i, i + 10));
    }

    for (const batch of batches) {
      await this.client.send(
        new SendMessageBatchCommand({
          QueueUrl: this.queueUrl,
          Entries: batch.map((q: any) => ({
            Id: randomUUID(), // ID for the batch entry
            MessageDeduplicationId: randomUUID(),
            MessageGroupId: revisionId,
            MessageBody: JSON.stringify({
              questionId: q.id,
              revisionId: revisionId,
              imageKey: q.imageKey,
              imageHash: q.imageHash,
              providerVersion: "textract@2024-01",
            }),
          })),
        }),
      );
    }
  }

  async enqueueQuestionOcrJob(questionId: string): Promise<void> {
    const question = await this.repository.triggerReOcr(questionId);

    await this.client.send(
      new SendMessageBatchCommand({
        QueueUrl: this.queueUrl,
        Entries: [
          {
            Id: randomUUID(),
            MessageDeduplicationId: randomUUID(),
            MessageGroupId: question.revisionId,
            MessageBody: JSON.stringify({
              questionId: question.id,
              revisionId: question.revisionId,
              imageKey: question.imageKey,
              imageHash: question.imageHash,
              providerVersion: "textract@2024-01",
            }),
          },
        ],
      }),
    );
  }
}

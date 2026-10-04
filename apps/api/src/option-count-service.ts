import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import type { PostgresDraftImportRepository } from "@onthilab/database";

export interface OptionCountService {
  enqueueRevision(revisionId: string): Promise<void>;
}

export class SqsOptionCountService implements OptionCountService {
  constructor(
    private readonly repository: PostgresDraftImportRepository,
    private readonly queueUrl: string,
    private readonly client = new SQSClient({}),
  ) {}

  async enqueueRevision(revisionId: string): Promise<void> {
    const jobs = await this.repository.queueOptionCountJobs(revisionId);
    let hadFailedEntries = false;
    for (let offset = 0; offset < jobs.length; offset += 10) {
      const batch = jobs.slice(offset, offset + 10);
      let response;
      try {
        response = await this.client.send(
          new SendMessageBatchCommand({
            QueueUrl: this.queueUrl,
            Entries: batch.map((job, index) => ({
              Id: String(index),
              MessageBody: JSON.stringify({
                questionId: job.id,
                revisionId,
                imageKey: job.imageKey,
                imageHash: job.imageHash,
              }),
            })),
          }),
        );
      } catch (error) {
        await this.repository.markOptionCountQueueFailed(
          jobs.slice(offset).map((job) => job.id),
          "Không thể đưa ảnh vào hàng đợi kiểm tra số lựa chọn.",
        );
        throw error;
      }
      const failed = new Set(response.Failed?.map((entry) => entry.Id));
      if (failed.size > 0) {
        hadFailedEntries = true;
        await this.repository.markOptionCountQueueFailed(
          batch
            .filter((_, index) => failed.has(String(index)))
            .map((job) => job.id),
          "Không thể đưa ảnh vào hàng đợi kiểm tra số lựa chọn.",
        );
      }
    }
    if (hadFailedEntries) {
      throw new Error(
        "Một số ảnh không vào được hàng đợi kiểm tra số lựa chọn.",
      );
    }
  }
}

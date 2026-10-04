import { describe, expect, it, vi } from "vitest";
import { SqsOptionCountService } from "./option-count-service";

const jobs = Array.from({ length: 12 }, (_, index) => ({
  id: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
  imageKey: `drafts/example/Q${index + 1}.webp`,
  imageHash: "a".repeat(64),
}));

describe("SqsOptionCountService", () => {
  it("queues every new question in SQS batches of at most ten", async () => {
    const send = vi.fn().mockResolvedValue({ Failed: [] });
    const repository = {
      queueOptionCountJobs: vi.fn().mockResolvedValue(jobs),
      markOptionCountQueueFailed: vi.fn(),
    };
    const service = new SqsOptionCountService(
      repository as never,
      "https://sqs.ap-southeast-1.amazonaws.com/123/options",
      { send } as never,
    );

    await service.enqueueRevision("revision-id");

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0].input.Entries).toHaveLength(10);
    expect(send.mock.calls[1]?.[0].input.Entries).toHaveLength(2);
    expect(repository.markOptionCountQueueFailed).not.toHaveBeenCalled();
  });

  it("marks rejected messages as failed and reports the queue failure", async () => {
    const repository = {
      queueOptionCountJobs: vi.fn().mockResolvedValue(jobs.slice(0, 2)),
      markOptionCountQueueFailed: vi.fn(),
    };
    const service = new SqsOptionCountService(
      repository as never,
      "https://sqs.ap-southeast-1.amazonaws.com/123/options",
      { send: vi.fn().mockResolvedValue({ Failed: [{ Id: "1" }] }) } as never,
    );

    await expect(service.enqueueRevision("revision-id")).rejects.toThrow();
    expect(repository.markOptionCountQueueFailed).toHaveBeenCalledWith(
      [jobs[1]?.id],
      expect.any(String),
    );
  });
});

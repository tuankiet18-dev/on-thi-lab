import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/http";
import {
  AnswerSaveQueue,
  retryTransientAttemptRequest,
} from "./answer-save-queue";

describe("AnswerSaveQueue", () => {
  it("coalesces rapid changes to the same question", async () => {
    let releaseFirst!: () => void;
    const firstSave = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const save = vi
      .fn<(answer: { sequence: number }) => Promise<void>>()
      .mockReturnValueOnce(firstSave)
      .mockResolvedValue(undefined);
    const queue = new AnswerSaveQueue({
      save,
      onStateChange: vi.fn(),
      retryDelaysMs: [],
    });

    queue.enqueue({ questionId: "q1", selectedOptions: [0], sequence: 1 });
    queue.enqueue({ questionId: "q1", selectedOptions: [1], sequence: 2 });
    queue.enqueue({ questionId: "q1", selectedOptions: [2], sequence: 3 });
    releaseFirst();
    await queue.flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toMatchObject({ sequence: 3 });
  });

  it("retries 429 and server errors before succeeding", async () => {
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "slow down"))
      .mockRejectedValueOnce(new ApiError(503, "UNAVAILABLE", "retry"))
      .mockResolvedValue(undefined);
    const sleep = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const states: string[] = [];
    const queue = new AnswerSaveQueue({
      save,
      sleep,
      random: () => 0,
      onStateChange: (state) => states.push(state),
    });

    queue.enqueue({ questionId: "q1", selectedOptions: [0], sequence: 1 });
    await queue.flush();

    expect(save).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toBe("saved");
  });

  it("keeps the answer pending after a permanent error", async () => {
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new ApiError(409, "ATTEMPT_CLOSED", "closed"));
    const states: string[] = [];
    const queue = new AnswerSaveQueue({
      save,
      onStateChange: (state) => states.push(state),
    });

    queue.enqueue({ questionId: "q1", selectedOptions: [0], sequence: 1 });
    await expect(queue.flush()).rejects.toBeInstanceOf(ApiError);
    expect(save).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe("offline");
  });
});

describe("retryTransientAttemptRequest", () => {
  it("retries an idempotent submit after throttling", async () => {
    const submit = vi
      .fn<() => Promise<{ status: string }>>()
      .mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "slow down"))
      .mockResolvedValue({ status: "submitted" });

    await expect(
      retryTransientAttemptRequest(submit, {
        retryDelaysMs: [10],
        sleep: vi.fn().mockResolvedValue(undefined),
        random: () => 0,
      }),
    ).resolves.toEqual({ status: "submitted" });
    expect(submit).toHaveBeenCalledTimes(2);
  });
});

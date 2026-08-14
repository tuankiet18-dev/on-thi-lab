import { ApiError } from "../../api/http";

export interface QueuedAnswer {
  questionId: string;
  selectedOptions: number[];
  sequence: number;
}

export type AnswerSaveState = "saved" | "saving" | "offline";

interface AnswerSaveQueueOptions {
  save: (answer: QueuedAnswer) => Promise<unknown>;
  onStateChange: (state: AnswerSaveState) => void;
  retryDelaysMs?: readonly number[];
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}

interface TransientRetryOptions {
  retryDelaysMs?: readonly number[];
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function isTransientAttemptError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError && (error.status === 429 || error.status >= 500))
  );
}

export async function retryTransientAttemptRequest<T>(
  operation: () => Promise<T>,
  options: TransientRetryOptions = {},
): Promise<T> {
  const retryDelays = options.retryDelaysMs ?? [250, 600, 1_200];
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientAttemptError(error) || attempt >= retryDelays.length) {
        throw error;
      }
      const jitter = Math.floor(retryDelays[attempt]! * 0.25 * random());
      await sleep(retryDelays[attempt]! + jitter);
    }
  }
}

/**
 * Serializes autosaves, coalesces rapid edits to the same question and retries
 * only transient failures. This avoids bursts while retaining the monotonic
 * sequence contract enforced by the API.
 */
export class AnswerSaveQueue {
  private readonly pending = new Map<string, QueuedAnswer>();
  private running: Promise<void> | null = null;
  private lastError: unknown;

  constructor(private readonly options: AnswerSaveQueueOptions) {}

  enqueue(answer: QueuedAnswer): void {
    this.pending.set(answer.questionId, answer);
    this.lastError = undefined;
    this.start();
  }

  async flush(): Promise<void> {
    if (this.pending.size > 0 && !this.running) {
      this.lastError = undefined;
      this.start();
    }
    await this.running;
    if (this.pending.size > 0) {
      throw this.lastError ?? new Error("Đáp án chưa được lưu.");
    }
  }

  private start(): void {
    if (this.running) return;
    this.running = this.drain().finally(() => {
      this.running = null;
    });
  }

  private async drain(): Promise<void> {
    this.options.onStateChange("saving");
    while (this.pending.size > 0) {
      const next = this.pending.entries().next().value as
        [string, QueuedAnswer] | undefined;
      if (!next) break;
      const [questionId, answer] = next;
      this.pending.delete(questionId);

      try {
        await this.saveWithRetry(answer);
      } catch (error) {
        // Do not overwrite a newer local selection queued during the request.
        if (!this.pending.has(questionId)) this.pending.set(questionId, answer);
        this.lastError = error;
        this.options.onStateChange("offline");
        return;
      }
    }
    this.options.onStateChange("saved");
  }

  private async saveWithRetry(answer: QueuedAnswer): Promise<void> {
    await retryTransientAttemptRequest(() => this.options.save(answer), {
      retryDelaysMs: this.options.retryDelaysMs,
      sleep: this.options.sleep,
      random: this.options.random,
    });
  }
}

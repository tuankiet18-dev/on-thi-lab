import { calculateScore, type AttemptResult } from "@onthilab/contracts";
import { demoAnswerKey, demoExam } from "../data/demo";

export interface LocalAttempt {
  id: string;
  examId: string;
  startedAt: string;
  expiresAt: string;
  answers: Record<string, number[]>;
  flagged: string[];
  submittedAt?: string;
  result?: AttemptResult;
}

const key = (attemptId: string) => `onthilab:attempt:${attemptId}`;

export function createOrResumeAttempt(): LocalAttempt {
  const existing = loadAttempt("demo-attempt");
  if (
    existing &&
    !existing.result &&
    Date.parse(existing.expiresAt) > Date.now()
  ) {
    return existing;
  }

  const startedAt = new Date();
  const attempt: LocalAttempt = {
    id: "demo-attempt",
    examId: demoExam.id,
    startedAt: startedAt.toISOString(),
    expiresAt: new Date(
      startedAt.getTime() + demoExam.durationMinutes * 60_000,
    ).toISOString(),
    answers: {},
    flagged: [],
  };
  saveAttempt(attempt);
  return attempt;
}

export function loadAttempt(attemptId: string): LocalAttempt | null {
  try {
    const raw = localStorage.getItem(key(attemptId));
    return raw ? (JSON.parse(raw) as LocalAttempt) : null;
  } catch {
    return null;
  }
}

export function saveAttempt(attempt: LocalAttempt): void {
  localStorage.setItem(key(attempt.id), JSON.stringify(attempt));
}

export function submitAttempt(
  attempt: LocalAttempt,
  reason: "user" | "timeout",
): LocalAttempt {
  if (attempt.result) return attempt;

  const result: AttemptResult = {
    attemptId: attempt.id,
    status: reason === "timeout" ? "auto_submitted" : "submitted",
    ...calculateScore(attempt.answers, demoAnswerKey),
    submittedAt: new Date().toISOString(),
  };
  const submitted = {
    ...attempt,
    result,
    submittedAt: result.submittedAt,
  };
  saveAttempt(submitted);
  return submitted;
}

export function resetDemoAttempt(): void {
  localStorage.removeItem(key("demo-attempt"));
}

import type {
  AiAnswerSuggestion,
  CreateDraftImportInput,
} from "@onthilab/contracts";
import { questions } from "../../schema";
import type { TrustedSuggestionAnswer } from "./model";

type QuestionAiMetadata = typeof questions.$inferSelect.aiMetadata;

/** Only unambiguous community consensus may be confirmed in bulk. */
export function trustedCommunitySuggestion(
  metadata: QuestionAiMetadata,
): TrustedSuggestionAnswer | null {
  const optionCount = metadata?.optionCount;
  if (
    metadata?.status !== "suggested" ||
    metadata.provider !== "community-comments" ||
    metadata.requiresReview !== false ||
    typeof metadata.optionCountConfidence !== "number" ||
    metadata.optionCountConfidence < 0.82 ||
    !metadata.optionCountSource ||
    (metadata.proposedType !== "single" &&
      metadata.proposedType !== "multiple") ||
    typeof optionCount !== "number" ||
    !Number.isInteger(optionCount) ||
    optionCount < 2 ||
    optionCount > 6 ||
    !Array.isArray(metadata.proposedAnswers) ||
    metadata.proposedAnswers.length === 0
  ) {
    return null;
  }

  const correctOptions = [...new Set(metadata.proposedAnswers)].sort(
    (left, right) => left - right,
  );
  if (
    correctOptions.length !== metadata.proposedAnswers.length ||
    correctOptions.some(
      (option) =>
        !Number.isInteger(option) || option < 0 || option >= optionCount,
    ) ||
    (metadata.proposedType === "single" && correctOptions.length !== 1) ||
    (metadata.proposedType === "multiple" && correctOptions.length < 2)
  ) {
    return null;
  }
  return { type: metadata.proposedType, optionCount, correctOptions };
}

export function toAiSuggestion(
  metadata: QuestionAiMetadata,
): AiAnswerSuggestion | null {
  if (!metadata?.status || !metadata.updatedAt) return null;
  return {
    status: metadata.status,
    proposedType: metadata.proposedType,
    optionCount: metadata.optionCount,
    optionCountConfidence: metadata.optionCountConfidence,
    optionCountSource: metadata.optionCountSource,
    proposedAnswers: metadata.proposedAnswers,
    confidence: metadata.confidence,
    provider: metadata.provider,
    model: metadata.model,
    error: metadata.error,
    validVotes: metadata.validVotes,
    totalComments: metadata.totalComments,
    voteBreakdown: metadata.voteBreakdown,
    requiresReview: metadata.requiresReview,
    disputeReason: metadata.disputeReason,
    updatedAt: metadata.updatedAt,
  };
}

export function buildExamCode(
  input: Pick<
    CreateDraftImportInput,
    "courseCode" | "semester" | "examType" | "isRetake"
  >,
): string {
  return [
    input.courseCode.toUpperCase(),
    input.semester.toUpperCase(),
    input.examType,
    ...(input.isRetake ? ["RETAKE"] : []),
  ].join("-");
}

export function isUniqueViolation(
  error: unknown,
  constraintName?: string,
): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && current.code === "23505") {
      if (constraintName && "constraint_name" in current) {
        return current.constraint_name === constraintName;
      }
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

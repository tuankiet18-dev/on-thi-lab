import type {
  AiAnswerSuggestion,
  CreateDraftImportInput,
} from "@onthilab/contracts";
import { questions } from "../../schema";
import type { TrustedSuggestionAnswer } from "./model";

type QuestionAiMetadata = typeof questions.$inferSelect.aiMetadata;

/** Option count evidence (OCR) strong enough for bulk confirmation. */
export function hasTrustedOptionCount(metadata: QuestionAiMetadata): boolean {
  return (
    typeof metadata?.optionCountConfidence === "number" &&
    metadata.optionCountConfidence >= 0.82 &&
    Boolean(metadata.optionCountSource)
  );
}

/** Only unambiguous community consensus may be confirmed in bulk. */
export function trustedCommunitySuggestion(
  metadata: QuestionAiMetadata,
): TrustedSuggestionAnswer | null {
  const optionCount = metadata?.optionCount;
  if (
    metadata?.status !== "suggested" ||
    metadata.provider !== "community-comments" ||
    metadata.requiresReview !== false ||
    !hasTrustedOptionCount(metadata) ||
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

export function answerReviewReason(metadata: QuestionAiMetadata): {
  code:
    | "missing_answer"
    | "conflicting_answers"
    | "invalid_answer"
    | "option_count_unverified";
  message: string;
} {
  const counts = Object.values(metadata?.voteBreakdown ?? {}).sort(
    (left, right) => right - left,
  );
  if (counts.length > 1 && counts[0] === counts[1]) {
    return {
      code: "conflicting_answers",
      message: "Các đáp án trong comments có số phiếu ngang nhau.",
    };
  }
  if (!metadata?.validVotes) {
    return {
      code: "missing_answer",
      message: "Không có comment chứa đáp án A–F rõ ràng.",
    };
  }
  if (metadata.requiresReview === false && !hasTrustedOptionCount(metadata)) {
    return {
      code: "option_count_unverified",
      message:
        "Đáp án cộng đồng rõ ràng nhưng chưa xác minh được số lựa chọn bằng OCR.",
    };
  }
  return {
    code: "invalid_answer",
    message:
      metadata.disputeReason ??
      "Đáp án gợi ý chưa hợp lệ; hãy chọn đáp án trong ảnh.",
  };
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

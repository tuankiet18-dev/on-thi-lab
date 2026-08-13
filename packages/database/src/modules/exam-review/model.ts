import type {
  ConfirmTrustedSuggestionsResult,
  CreateDraftImportInput,
  DraftExamReview,
  DraftImportResult,
  PublishExamResult,
  ReviewQuestion,
  ReviewReadinessResult,
  UpdateQuestionAnswerInput,
} from "@onthilab/contracts";

export interface DraftQuestionInput {
  order: number;
  imageKey: string;
  imageHash: string;
  type?: "single" | "multiple";
  optionCount: number;
  correctOptions?: number[];
  aiMetadata?: any;
}

export interface CreateDraftExamInput extends CreateDraftImportInput {
  createdBy: string;
  questions: DraftQuestionInput[];
}

export type DraftImportRepositoryErrorCode =
  | "ANSWERS_INCOMPLETE"
  | "CAMPUS_NOT_FOUND"
  | "COURSE_NOT_FOUND"
  | "EXAM_ALREADY_EXISTS"
  | "EXAM_NOT_EDITABLE"
  | "EXAM_NOT_FOUND"
  | "EXAM_NOT_READY"
  | "QUESTION_NOT_FOUND"
  | "DUPLICATE_IMAGES";

export class DraftImportRepositoryError extends Error {
  constructor(
    readonly code: DraftImportRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DraftImportRepositoryError";
  }
}

export interface DraftImportRepository {
  createDraft(input: CreateDraftExamInput): Promise<DraftImportResult>;
}

export type StoredReviewQuestion = Omit<ReviewQuestion, "imageUrl"> & {
  imageKey: string;
};

export type StoredDraftExamReview = Omit<DraftExamReview, "questions"> & {
  questions: StoredReviewQuestion[];
};

export interface AdminExamSummary {
  id: string;
  code: string;
  courseCode: string;
  semester: string;
  status: string;
  creatorName: string;
  createdAt: Date;
}

export interface ExamReviewRepository {
  findDrafts(): Promise<AdminExamSummary[]>;
  findAllExams(): Promise<AdminExamSummary[]>;
  deleteExam(examId: string): Promise<void>;
  findReview(examId: string): Promise<StoredDraftExamReview | null>;
  saveAnswer(input: {
    examId: string;
    questionId: string;
    changedBy: string;
    answer: UpdateQuestionAnswerInput;
  }): Promise<StoredReviewQuestion>;
  confirmTrustedSuggestions(
    examId: string,
    changedBy: string,
  ): Promise<ConfirmTrustedSuggestionsResult>;
  markReady(examId: string, changedBy: string): Promise<ReviewReadinessResult>;
  publish(examId: string, approvedBy: string): Promise<PublishExamResult>;
}

export interface AiSuggestionJob {
  examId: string;
  questionId: string;
  imageKey: string;
  courseCode: string;
  optionCount: number;
}

export interface AiAnswerProposalInput {
  proposedType: "single" | "multiple";
  optionCount: number;
  proposedAnswers: number[];
  confidence: number;
  provider: string;
  model: string;
  rationale?: string;
  raw?: unknown;
}

export interface AiSuggestionRepository {
  queueUnanswered(examId: string): Promise<{
    jobs: AiSuggestionJob[];
    skippedCount: number;
  }>;
  queueQuestion(
    examId: string,
    questionId: string,
  ): Promise<{ jobs: AiSuggestionJob[]; skippedCount: number }>;
  markProcessing(questionId: string): Promise<void>;
  saveSuggestion(
    questionId: string,
    proposal: AiAnswerProposalInput,
  ): Promise<void>;
  markFailed(questionId: string, message: string): Promise<void>;
}

export interface TrustedSuggestionAnswer {
  type: "single" | "multiple";
  optionCount: number;
  correctOptions: number[];
}

import type {
  AdminAttentionSummary,
  StudentProfile,
} from "@onthilab/contracts";
import type {
  AdminAttentionRepository,
  AdminCatalogRepository,
  AttemptRepository,
  BookmarkRepository,
  CatalogRepository,
  ExamReviewRepository,
  FeedbackRepository,
  PostgresOcrRepository,
  ReportRepository,
  UserProfileRepository,
} from "@onthilab/database";
import type { AuthIdentity, TokenVerifier } from "./auth";
import type { AnswerSuggestionService } from "./answer-suggestion-service";
import type { ExamImportService } from "./import-service";
import type { OcrService } from "./ocr-service.js";
import type { QuestionImageReader } from "./question-image-reader";

export interface AppDependencies {
  catalog: CatalogRepository;
  adminCatalog: AdminCatalogRepository;
  auth: TokenVerifier;
  profiles: UserProfileRepository;
  imports: ExamImportService;
  reviews: ExamReviewRepository;
  images: QuestionImageReader;
  attempts: AttemptRepository;
  suggestions: AnswerSuggestionService;
  reports: ReportRepository;
  bookmarks: BookmarkRepository;
  feedback: FeedbackRepository;
  ocrRepository?: PostgresOcrRepository;
  ocrService: OcrService;
  attention: AdminAttentionRepository;
  questionImageBaseUrl?: string;
  corsOrigins: string[];
}

export type AppEnvironment = {
  Variables: {
    identity: AuthIdentity;
    profile: StudentProfile;
  };
};

export class UnconfiguredReportRepository implements ReportRepository {
  async createReport(): Promise<never> {
    throw new Error("Report repository not configured");
  }
  async listPendingReports(): Promise<never[]> {
    throw new Error("Report repository not configured");
  }
  async resolveReport(): Promise<never> {
    throw new Error("Report repository not configured");
  }
}

export class UnconfiguredBookmarkRepository implements BookmarkRepository {
  async listForUser(): Promise<never> {
    throw new Error("Bookmark repository not configured");
  }
  async saveExam(): Promise<never> {
    throw new Error("Bookmark repository not configured");
  }
  async removeExam(): Promise<never> {
    throw new Error("Bookmark repository not configured");
  }
  async saveQuestion(): Promise<never> {
    throw new Error("Bookmark repository not configured");
  }
  async removeQuestion(): Promise<never> {
    throw new Error("Bookmark repository not configured");
  }
}

export class UnconfiguredFeedbackRepository implements FeedbackRepository {
  async create(): Promise<never> {
    throw new Error("Feedback repository not configured");
  }
  async listNew(): Promise<never[]> {
    throw new Error("Feedback repository not configured");
  }
  async resolve(): Promise<null> {
    throw new Error("Feedback repository not configured");
  }
}

export class UnconfiguredAdminAttentionRepository implements AdminAttentionRepository {
  async getSummary(): Promise<AdminAttentionSummary> {
    throw new Error("Admin attention repository not configured");
  }
}

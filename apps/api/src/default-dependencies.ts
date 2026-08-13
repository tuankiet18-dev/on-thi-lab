import type {
  AdminCatalogRepository,
  CatalogRepository,
  ExamReviewRepository,
  UserProfileRepository,
} from "@onthilab/database";
import type { AppDependencies } from "./app-context";
import {
  UnconfiguredAdminAttentionRepository,
  UnconfiguredBookmarkRepository,
  UnconfiguredFeedbackRepository,
  UnconfiguredReportRepository,
} from "./app-context";
import { UnconfiguredAnswerSuggestionService } from "./answer-suggestion-service";
import { UnconfiguredTokenVerifier } from "./auth";
import { demoExam } from "./fixtures";
import { UnconfiguredExamImportService } from "./import-service";
import { MemoryAttemptRepository } from "./memory-attempt-repository";
import { UnconfiguredOcrService } from "./ocr-service.js";
import { UnconfiguredQuestionImageReader } from "./question-image-reader";

const demoCatalogRepository: CatalogRepository = {
  listCampuses: async () => [],
  listMajors: async () => [],
  listCurricula: async () => [],
  listTermCourses: async () => [],
  listPublished: async () => [demoExam],
  findPublishedByIdOrCode: async (idOrCode) =>
    idOrCode === demoExam.id || idOrCode === demoExam.code ? demoExam : null,
};

const unavailableAdminCatalogRepository: AdminCatalogRepository = {
  getAdminCatalog: async () => ({ majors: [], curricula: [], courses: [] }),
  createMajor: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
  createCurriculum: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
  createCourse: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
  updateCourse: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
  deleteCourse: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
  upsertCurriculumCourse: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
};

const unavailableProfileRepository: UserProfileRepository = {
  findBySubject: async () => {
    throw new Error("Profile storage is not configured");
  },
  listOptions: async () => {
    throw new Error("Profile storage is not configured");
  },
  upsert: async () => {
    throw new Error("Profile storage is not configured");
  },
  updateRole: async () => {
    throw new Error("Profile storage is not configured");
  },
  searchUsers: async () => {
    throw new Error("Profile storage is not configured");
  },
};

const unavailableReviewRepository: ExamReviewRepository = {
  findDrafts: async () => [],
  findAllExams: async () => [],
  deleteExam: async () => {},
  findReview: async () => null,
  saveAnswer: async () => {
    throw new Error("Review storage is not configured");
  },
  confirmTrustedSuggestions: async () => {
    throw new Error("Review storage is not configured");
  },
  markReady: async () => {
    throw new Error("Review storage is not configured");
  },
  publish: async () => {
    throw new Error("Review storage is not configured");
  },
};

export function createDefaultDependencies(): AppDependencies {
  return {
    catalog: demoCatalogRepository,
    adminCatalog: unavailableAdminCatalogRepository,
    auth: new UnconfiguredTokenVerifier(),
    profiles: unavailableProfileRepository,
    imports: new UnconfiguredExamImportService(),
    reviews: unavailableReviewRepository,
    images: new UnconfiguredQuestionImageReader(),
    attempts: new MemoryAttemptRepository(),
    suggestions: new UnconfiguredAnswerSuggestionService(),
    reports: new UnconfiguredReportRepository(),
    bookmarks: new UnconfiguredBookmarkRepository(),
    feedback: new UnconfiguredFeedbackRepository(),
    attention: new UnconfiguredAdminAttentionRepository(),
    ocrService: new UnconfiguredOcrService(),
    corsOrigins: ["http://localhost:5173"],
  };
}

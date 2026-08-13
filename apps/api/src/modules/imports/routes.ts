import {
  createDraftImportSchema,
  feZipImportConstraints,
} from "@onthilab/contracts";
import { DraftImportRepositoryError } from "@onthilab/database";
import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppDependencies, AppEnvironment } from "../../app-context";
import { isUploadedArchive } from "../../http/question-images";
import { ExamImportError } from "../../import-service";

export function registerImportRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
): void {
  app.get("/v1/admin/imports/config", (context) =>
    context.json({
      data: {
        examType: "FE",
        ...feZipImportConstraints,
        canPublish: context.get("profile").role === "admin",
      },
    }),
  );

  app.get("/v1/admin/imports/presign", async (context) => {
    if (!dependencies.imports.createPresignedUploadUrl) {
      return context.json({ error: "IMPORT_NOT_CONFIGURED" }, 503);
    }
    try {
      return context.json({
        data: await dependencies.imports.createPresignedUploadUrl(),
      });
    } catch {
      return context.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });

  app.use(
    "/v1/admin/imports",
    bodyLimit({
      maxSize: feZipImportConstraints.maxArchiveBytes + 1024 * 1024,
      onError: (context) => context.json({ error: "ARCHIVE_TOO_LARGE" }, 413),
    }),
  );

  app.post("/v1/admin/imports", async (context) => {
    let metadata: unknown;
    let archiveKey: string | undefined;
    let archive: File | undefined;

    const contentType = context.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const body = await context.req.json();
        metadata = body.metadata;
        archiveKey = body.archiveKey;
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
    } else {
      let form: Record<string, string | File>;
      try {
        form = await context.req.parseBody();
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const metadataValue = form.metadata;
      archive = form.archive instanceof File ? form.archive : undefined;
      if (typeof metadataValue !== "string" || !isUploadedArchive(archive)) {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      try {
        metadata = JSON.parse(metadataValue);
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
    }

    const parsed = createDraftImportSchema.safeParse(metadata);
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    try {
      const result = await dependencies.imports.createDraft({
        metadata: parsed.data,
        archive,
        archiveKey,
        creator: context.get("profile"),
      });

      let ocrQueueWarning: string | undefined;
      if (parsed.data.extractText) {
        try {
          await dependencies.ocrService.enqueueRevisionOcrJobs(
            result.revisionId,
          );
        } catch (error) {
          console.error("Unable to queue OCR jobs", error);
          ocrQueueWarning =
            "Đề đã được tạo nhưng chưa thể đưa vào hàng đợi OCR. Hãy thử OCR lại từ trang duyệt.";
        }
      }
      return context.json(
        {
          data: {
            ...result,
            ...(ocrQueueWarning ? { ocrQueueWarning } : {}),
          },
        },
        201,
      );
    } catch (error) {
      if (error instanceof DraftImportRepositoryError) {
        const status = error.code === "EXAM_ALREADY_EXISTS" ? 409 : 400;
        return context.json(
          { error: error.code, message: error.message },
          status,
        );
      }
      if (error instanceof ExamImportError) {
        const status =
          error.code === "IMPORT_NOT_CONFIGURED"
            ? 503
            : error.code === "ARCHIVE_TOO_LARGE"
              ? 413
              : 400;
        return context.json(
          { error: error.code, message: error.message },
          status,
        );
      }
      throw error;
    }
  });
}

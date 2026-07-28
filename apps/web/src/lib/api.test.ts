import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createAttempt,
  getAttempt,
  getAttemptSession,
  getCatalog,
  getDraftExamReview,
  getPublishedExam,
  markExamReviewReady,
  getMyProfile,
  publishExam,
  queueAiAnswerSuggestions,
  saveMyProfile,
  saveAttemptAnswer,
  saveQuestionReviewAnswer,
  submitAttempt,
  uploadDraftImport,
} from "./api";

const profile = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "student@example.com",
  fullName: "Lương Tuấn Kiệt",
  studentCode: "HE170001",
  campus: { code: "HL", name: "Hòa Lạc" },
  major: { code: "SE", name: "Software Engineering" },
  curriculum: null,
  role: "user",
} as const;

describe("profile API client", () => {
  it("sends the Cognito ID token and validates a saved profile", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: profile }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await saveMyProfile(
      "signed-id-token",
      {
        fullName: profile.fullName,
        studentCode: profile.studentCode,
        campusCode: profile.campus.code,
        majorCode: profile.major.code,
      },
      fetcher,
    );

    expect(result).toEqual(profile);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8787/v1/me",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer signed-id-token",
        }),
      }),
    );
  });

  it("returns null before onboarding", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: null }), { status: 200 }),
      );
    await expect(getMyProfile("signed-id-token", fetcher)).resolves.toBeNull();
  });

  it("preserves API status and error code", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "PROFILE_CONFLICT" }), {
        status: 409,
      }),
    );

    await expect(
      saveMyProfile(
        "signed-id-token",
        {
          fullName: profile.fullName,
          studentCode: profile.studentCode,
          campusCode: profile.campus.code,
          majorCode: profile.major.code,
        },
        fetcher,
      ),
    ).rejects.toEqual(
      new ApiError(
        409,
        "PROFILE_CONFLICT",
        "API request failed with status 409",
      ),
    );
  });

  it("uploads ZIP data without overriding the multipart boundary", async () => {
    const draft = {
      examId: "20000000-0000-4000-8000-000000000001",
      revisionId: "30000000-0000-4000-8000-000000000001",
      examCode: "SWD392-SP26-FE",
      questionCount: 60,
      status: "draft",
    } as const;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url: URL | string | Request) => {
        const urlString =
          typeof url === "string" ? url : ((url as URL).toString?.() ?? "");
        if (urlString.includes("/presign")) {
          return new Response(
            JSON.stringify({
              data: { uploadUrl: "https://s3/upload", key: "test-key" },
            }),
            {
              headers: { "content-type": "application/json" },
            },
          );
        }
        if (urlString.includes("https://s3/upload")) {
          return new Response(null, { status: 200 });
        }
        return new Response(JSON.stringify({ data: draft }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      });

    await expect(
      uploadDraftImport(
        "signed-id-token",
        {
          courseCode: "SWD392",
          semester: "SP26",
          campusCode: "HL",
          examType: "FE",
          isRetake: false,
          durationMinutes: 60,
        },
        new File(["PK"], "questions.zip", { type: "application/zip" }),
        fetcher,
      ),
    ).resolves.toEqual(draft);

    const requestInit = fetcher.mock.calls[2]?.[1];
    expect(requestInit?.body).toBeTypeOf("string");
    expect(new Headers(requestInit?.headers).get("content-type")).toContain(
      "application/json",
    );
  });

  it("loads, saves and completes an answer review", async () => {
    const examId = "20000000-0000-4000-8000-000000000001";
    const questionId = "40000000-0000-4000-8000-000000000001";
    const review = {
      examId,
      revisionId: "30000000-0000-4000-8000-000000000001",
      examCode: "SWD392-SP26-FE",
      courseCode: "SWD392",
      courseName: "Software Architecture and Design",
      semester: "SP26",
      campus: { code: "HL", name: "Hòa Lạc" },
      durationMinutes: 60,
      isRetake: false,
      status: "draft",
      publishedAt: null,
      answeredCount: 0,
      questionCount: 1,
      questions: [
        {
          id: questionId,
          order: 1,
          imageUrl: "http://localhost:8787/question-images/drafts/Q1.jpg",
          type: "single",
          options: ["A", "B", "C", "D"],
          correctOptions: [],
          aiSuggestion: null,
        },
      ],
    } as const;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: review }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: questionId,
              order: 1,
              type: "single",
              options: ["A", "B", "C", "D"],
              correctOptions: [1],
              aiSuggestion: null,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              examId,
              status: "review",
              answeredCount: 1,
              questionCount: 1,
            },
          }),
          { status: 200 },
        ),
      );

    await expect(
      getDraftExamReview("signed-id-token", examId, fetcher),
    ).resolves.toEqual(review);
    await expect(
      saveQuestionReviewAnswer(
        "signed-id-token",
        examId,
        questionId,
        { type: "single", optionCount: 4, correctOptions: [1] },
        fetcher,
      ),
    ).resolves.toMatchObject({ correctOptions: [1] });
    await expect(
      markExamReviewReady("signed-id-token", examId, fetcher),
    ).resolves.toMatchObject({ status: "review" });

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `http://localhost:8787/v1/admin/exams/${examId}/review`,
      `http://localhost:8787/v1/admin/exams/${examId}/questions/${questionId}/answer`,
      `http://localhost:8787/v1/admin/exams/${examId}/ready`,
    ]);
  });

  it("publishes a reviewed exam and loads it from the live catalog", async () => {
    const examId = "20000000-0000-4000-8000-000000000001";
    const publishedAt = "2026-07-24T06:00:00.000Z";
    const summary = {
      id: examId,
      code: "SWD392-SP26-FE",
      courseCode: "SWD392",
      courseName: "Software Architecture and Design",
      semester: "SP26",
      campus: "Hòa Lạc",
      examType: "FE",
      isRetake: false,
      durationMinutes: 60,
      questionCount: 1,
      publishedAt,
      answerConfidence: "verified",
    } as const;
    const exam = {
      ...summary,
      instructions: ["Không thể tạm dừng."],
      shuffleQuestions: true,
      questions: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          order: 1,
          imageUrl: "http://localhost:8787/question-images/Q1.jpg",
          imageAlt: "Câu hỏi 1",
          type: "single",
          options: ["A", "B", "C", "D"],
        },
      ],
    } as const;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              examId,
              revisionId: "30000000-0000-4000-8000-000000000001",
              status: "published",
              publishedAt,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [summary] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: exam }), { status: 200 }),
      );

    await expect(
      publishExam("signed-id-token", examId, fetcher),
    ).resolves.toMatchObject({ status: "published" });
    await expect(getCatalog("signed-id-token", fetcher)).resolves.toEqual([
      summary,
    ]);
    await expect(
      getPublishedExam("signed-id-token", examId, fetcher),
    ).resolves.toEqual(exam);
  });

  it("queues AI suggestions without sending provider credentials to the browser", async () => {
    const examId = "20000000-0000-4000-8000-000000000001";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { examId, queuedCount: 60, skippedCount: 0 },
        }),
        { status: 202 },
      ),
    );

    await expect(
      queueAiAnswerSuggestions("signed-id-token", examId, fetcher),
    ).resolves.toEqual({ examId, queuedCount: 60, skippedCount: 0 });
    expect(fetcher).toHaveBeenCalledWith(
      `http://localhost:8787/v1/admin/exams/${examId}/ai-suggestions`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer signed-id-token",
        }),
      }),
    );
  });

  it("creates, saves, submits and reloads a server attempt", async () => {
    const attemptId = "50000000-0000-4000-8000-000000000001";
    const examId = "20000000-0000-4000-8000-000000000001";
    const questionId = "40000000-0000-4000-8000-000000000001";
    const startedAt = "2026-07-24T06:00:00.000Z";
    const expiresAt = "2026-07-24T07:00:00.000Z";
    const submittedAt = "2026-07-24T06:20:00.000Z";
    const activeAttempt = {
      id: attemptId,
      examId,
      status: "in_progress",
      startedAt,
      expiresAt,
      answers: {},
      questionOrder: [questionId],
      result: null,
    } as const;
    const result = {
      attemptId,
      status: "submitted",
      correctCount: 1,
      questionCount: 1,
      score: 10,
      submittedAt,
    } as const;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { attempt: activeAttempt, resumed: false },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { savedAt: startedAt, sequence: 1 },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: result }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              ...activeAttempt,
              status: "submitted",
              answers: { [questionId]: [1] },
              result,
              correctAnswers: { [questionId]: [1] },
            },
          }),
          { status: 200 },
        ),
      );

    await expect(
      createAttempt("signed-id-token", examId, "device-0001", fetcher),
    ).resolves.toMatchObject({ resumed: false });
    await expect(
      saveAttemptAnswer(
        "signed-id-token",
        attemptId,
        { questionId, selectedOptions: [1], sequence: 1 },
        fetcher,
      ),
    ).resolves.toMatchObject({ sequence: 1 });
    await expect(
      submitAttempt("signed-id-token", attemptId, "user", fetcher),
    ).resolves.toEqual(result);
    await expect(
      getAttempt("signed-id-token", attemptId, fetcher),
    ).resolves.toMatchObject({ status: "submitted" });
  });

  it("loads an immutable attempt session for review", async () => {
    const attemptId = "50000000-0000-4000-8000-000000000001";
    const examId = "20000000-0000-4000-8000-000000000001";
    const questionId = "40000000-0000-4000-8000-000000000001";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            attempt: {
              id: attemptId,
              examId,
              status: "submitted",
              startedAt: "2026-07-24T06:00:00.000Z",
              expiresAt: "2026-07-24T07:00:00.000Z",
              answers: { [questionId]: [1] },
              questionOrder: [questionId],
              result: {
                attemptId,
                status: "submitted",
                correctCount: 1,
                questionCount: 1,
                score: 10,
                submittedAt: "2026-07-24T06:20:00.000Z",
              },
              correctAnswers: { [questionId]: [1] },
            },
            exam: {
              id: examId,
              code: "SWD392-SP26-FE",
              courseCode: "SWD392",
              courseName: "Software Architecture and Design",
              semester: "SP26",
              campus: "Hòa Lạc",
              examType: "FE",
              isRetake: false,
              durationMinutes: 60,
              questionCount: 1,
              publishedAt: "2026-07-24T06:00:00.000Z",
              answerConfidence: "reviewed",
              shuffleQuestions: true,
              instructions: [],
              questions: [
                {
                  id: questionId,
                  order: 1,
                  imageUrl: "https://example.test/Q1.jpg",
                  imageAlt: "Câu hỏi 1",
                  type: "single",
                  options: ["A", "B", "C", "D"],
                },
              ],
            },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      getAttemptSession("signed-id-token", attemptId, fetcher),
    ).resolves.toMatchObject({
      attempt: { id: attemptId, correctAnswers: { [questionId]: [1] } },
      exam: { questions: [{ id: questionId }] },
    });
    expect(fetcher).toHaveBeenCalledWith(
      `http://localhost:8787/v1/attempts/${attemptId}/session`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer signed-id-token",
        }),
      }),
    );
  });
});

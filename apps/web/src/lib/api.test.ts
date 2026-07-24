import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  getDraftExamReview,
  markExamReviewReady,
  getMyProfile,
  saveMyProfile,
  saveQuestionReviewAnswer,
  uploadDraftImport,
} from "./api";

const profile = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "student@example.com",
  fullName: "Lương Tuấn Kiệt",
  studentCode: "HE170001",
  campus: { code: "HL", name: "Hòa Lạc" },
  major: { code: "SE", name: "Software Engineering" },
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
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: draft }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

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

    const requestInit = fetcher.mock.calls[0]?.[1];
    expect(requestInit?.body).toBeInstanceOf(FormData);
    expect(new Headers(requestInit?.headers).has("content-type")).toBe(false);
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
});

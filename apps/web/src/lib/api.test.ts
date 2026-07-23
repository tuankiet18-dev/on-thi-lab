import { describe, expect, it, vi } from "vitest";
import { ApiError, getMyProfile, saveMyProfile } from "./api";

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
});

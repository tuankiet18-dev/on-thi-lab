import { describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleVisionProvider } from "./openai-compatible-provider";

describe("OpenAI-compatible vision provider", () => {
  it("sends the image server-side and validates JSON output", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questionType: "multiple",
                  optionCount: 4,
                  proposedAnswers: [0, 2],
                  confidence: 0.76,
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new OpenAiCompatibleVisionProvider({
      apiKey: "server-secret",
      model: "vision-test",
      baseUrl: "https://ai.example.test/v1/",
      fetcher,
    });

    await expect(
      provider.proposeAnswer({
        imageDataUrl: "data:image/jpeg;base64,/9j/",
        courseCode: "SWD392",
        optionCount: 4,
      }),
    ).resolves.toMatchObject({
      questionType: "multiple",
      proposedAnswers: [0, 2],
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://ai.example.test/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer server-secret",
        }),
      }),
    );
    const request = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      max_completion_tokens: 256,
    });
  });

  it("waits for the provider retry window after a rate-limit response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: "Rate limit reached. Please try again in 0s." },
          }),
          { status: 429, headers: { "retry-after": "0" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    questionType: "single",
                    optionCount: 4,
                    proposedAnswers: [2],
                    confidence: 0.9,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const provider = new OpenAiCompatibleVisionProvider({
      apiKey: "server-secret",
      model: "vision-test",
      fetcher,
      maxRetries: 1,
    });

    await expect(
      provider.proposeAnswer({
        imageDataUrl: "data:image/jpeg;base64,/9j/",
        courseCode: "SWD392",
        optionCount: 4,
      }),
    ).resolves.toMatchObject({ proposedAnswers: [2] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not expose the provider response when retries are exhausted", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "Organization secret-org-id exceeded its limit.",
          },
        }),
        { status: 429 },
      ),
    );
    const provider = new OpenAiCompatibleVisionProvider({
      apiKey: "server-secret",
      model: "vision-test",
      fetcher,
      maxRetries: 0,
    });

    await expect(
      provider.proposeAnswer({
        imageDataUrl: "data:image/jpeg;base64,/9j/",
        courseCode: "SWD392",
        optionCount: 4,
      }),
    ).rejects.toThrow("AI provider đang giới hạn tốc độ");
  });

  it("does not wait for a multi-hour daily rate-limit reset", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Daily token limit reached." },
        }),
        { status: 429, headers: { "retry-after": "14400" } },
      ),
    );
    const provider = new OpenAiCompatibleVisionProvider({
      apiKey: "server-secret",
      model: "vision-test",
      fetcher,
      maxRetries: 4,
    });

    await expect(
      provider.proposeAnswer({
        imageDataUrl: "data:image/jpeg;base64,/9j/",
        courseCode: "SWD392",
        optionCount: 4,
      }),
    ).rejects.toThrow("AI provider đang giới hạn tốc độ");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

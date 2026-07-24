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
  });
});

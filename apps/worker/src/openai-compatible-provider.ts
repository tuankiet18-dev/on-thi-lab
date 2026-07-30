import {
  validateAiProposal,
  type AiAnswerProposal,
  type AiVisionProvider,
} from "./index.js";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export interface OpenAiCompatibleVisionProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  providerName?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  maxRetryDelayMs?: number;
  maxCompletionTokens?: number;
  reasoningEffort?: "none" | "default" | "low" | "medium" | "high";
}

export class OpenAiCompatibleVisionProvider implements AiVisionProvider {
  readonly providerName: string;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxRetryDelayMs: number;
  private readonly maxCompletionTokens: number;
  private readonly reasoningEffort:
    "none" | "default" | "low" | "medium" | "high" | undefined;

  constructor(options: OpenAiCompatibleVisionProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.providerName = options.providerName ?? "openai-compatible";
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.maxRetries = options.maxRetries ?? 4;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 90_000;
    this.maxCompletionTokens = options.maxCompletionTokens ?? 256;
    this.reasoningEffort = options.reasoningEffort;
  }

  async proposeAnswer(input: {
    imageDataUrl: string;
    courseCode: string;
    optionCount: number;
  }): Promise<AiAnswerProposal> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_completion_tokens: this.maxCompletionTokens,
          ...(this.reasoningEffort
            ? { reasoning_effort: this.reasoningEffort }
            : {}),
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Bạn phân tích ảnh câu hỏi trắc nghiệm để tạo đáp án THAM KHẢO cho quản trị viên. Không khẳng định chắc chắn khi ảnh thiếu dữ liệu. Chỉ trả JSON.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: [
                    `Môn học: ${input.courseCode}.`,
                    `Hệ thống đang tạm cấu hình ${input.optionCount} lựa chọn; hãy tự nhận diện lại số lựa chọn thật từ ảnh, không mặc định theo giá trị này.`,
                    "Trả JSON gồm questionType (single|multiple), optionCount, proposedAnswers (mảng chỉ số), confidence (0..1).",
                    "Không đưa nội dung giải thích dài. Có thể thêm rationale ngắn để audit nội bộ.",
                  ].join(" "),
                },
                {
                  type: "image_url",
                  image_url: {
                    url: input.imageDataUrl,
                    detail: "high",
                  },
                },
              ],
            },
          ],
        }),
      });

      const body = (await response
        .json()
        .catch(() => ({}))) as ChatCompletionResponse;
      if (response.status === 429 && attempt < this.maxRetries) {
        const delay = retryDelayMilliseconds(response, body, attempt);
        if (delay <= this.maxRetryDelayMs) {
          await wait(delay);
          continue;
        }
      }
      if (!response.ok) {
        throw new Error(safeProviderError(response.status));
      }
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI provider không trả về nội dung.");

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("AI provider trả về JSON không hợp lệ.");
      }
      return validateAiProposal(parsed);
    }

    throw new Error("AI provider tạm thời không sẵn sàng.");
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelayMilliseconds(
  response: Response,
  body: ChatCompletionResponse,
  attempt: number,
): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return retryAfter * 1_000 + 250;
  }
  const describedSeconds = body.error?.message?.match(
    /try again in ([0-9.]+)s/i,
  )?.[1];
  if (describedSeconds) {
    return Number(describedSeconds) * 1_000 + 250;
  }
  return Math.min(30_000, 2_000 * 2 ** attempt);
}

function safeProviderError(status: number): string {
  if (status === 400 || status === 422) {
    return "AI provider từ chối ảnh hoặc cấu hình model.";
  }
  if (status === 401 || status === 403) {
    return "Khóa AI không hợp lệ hoặc chưa được cấp quyền model.";
  }
  if (status === 413) return "Ảnh vượt quá giới hạn của AI provider.";
  if (status === 429) {
    return "AI provider đang giới hạn tốc độ. Hãy thử lại sau.";
  }
  return "AI provider tạm thời không sẵn sàng.";
}

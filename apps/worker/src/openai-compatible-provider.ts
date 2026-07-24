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
}

export class OpenAiCompatibleVisionProvider implements AiVisionProvider {
  readonly providerName: string;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

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
  }

  async proposeAnswer(input: {
    imageDataUrl: string;
    courseCode: string;
    optionCount: number;
  }): Promise<AiAnswerProposal> {
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
                  `Hệ thống đang cấu hình ${input.optionCount} lựa chọn, đánh số từ 0.`,
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
    if (!response.ok) {
      throw new Error(
        body.error?.message ?? `AI provider trả về HTTP ${response.status}.`,
      );
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
}

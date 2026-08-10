import { describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  webConfig: { apiUrl: "https://api.example.test/staging/" },
  hasConfiguredApiUrl: true,
}));

import { questionImageUrl } from "./question-image-url";

describe("questionImageUrl", () => {
  it("keeps the API Gateway stage path for relative image URLs", () => {
    expect(questionImageUrl("/question-images/drafts/example/Q1.jpg")).toBe(
      "https://api.example.test/staging/question-images/drafts/example/Q1.jpg",
    );
  });

  it("does not alter an already absolute image URL", () => {
    expect(questionImageUrl("https://cdn.example.test/Q1.jpg")).toBe(
      "https://cdn.example.test/Q1.jpg",
    );
  });

  it("repairs legacy OCR responses that expose a raw draft image key", () => {
    expect(questionImageUrl("drafts/example/Q1.webp")).toBe(
      "https://api.example.test/staging/question-images/drafts/example/Q1.webp",
    );
  });
});

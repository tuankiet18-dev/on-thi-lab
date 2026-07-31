import { describe, expect, it } from "vitest";
import { normalizeQuestionText } from "./ocr-text-normalizer.js";

describe("normalizeQuestionText", () => {
  it("extracts stem and options correctly", () => {
    const rawText = `What is the capital of France?
A. Paris
B. London
C. Berlin
D. Madrid`;
    const result = normalizeQuestionText(rawText);
    expect(result.stem).toBe("What is the capital of France?");
    expect(result.options).toEqual(["Paris", "London", "Berlin", "Madrid"]);
    expect(result.optionCount).toBe(4);
  });

  it("handles multi-line options", () => {
    const rawText = `Solve for x:
A. x = 1
and y = 2
B. x = 2
C. x = 3
D. x = 4`;
    const result = normalizeQuestionText(rawText);
    expect(result.stem).toBe("Solve for x:");
    expect(result.options).toEqual([
      "x = 1\nand y = 2",
      "x = 2",
      "x = 3",
      "x = 4",
    ]);
    expect(result.optionCount).toBe(4);
  });

  it("returns raw text if no options found", () => {
    const rawText = `This is a question without options.
It just has text.`;
    const result = normalizeQuestionText(rawText);
    expect(result.stem).toBe(rawText);
    expect(result.options).toEqual([]);
    expect(result.optionCount).toBe(0);
  });

  it("handles options with parenthesis", () => {
    const rawText = `Question?
A) Option A
B) Option B`;
    const result = normalizeQuestionText(rawText);
    expect(result.options).toEqual(["Option A", "Option B"]);
  });
});

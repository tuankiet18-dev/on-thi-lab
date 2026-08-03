import { describe, expect, it } from "vitest";
import { classifyQuestion } from "./ocr-classification.js";

describe("classifyQuestion", () => {
  it("flags low confidence", () => {
    const flags = classifyQuestion({
      rawText: "Sample",
      confidence: 0.6,
      imageWidth: 800,
      imageHeight: 600,
      parsedOptionCount: 4,
    });
    expect(flags).toContain("low_confidence");
  });

  it("flags formulas", () => {
    const flags = classifyQuestion({
      rawText: "Calculate ∫ x dx",
      confidence: 0.9,
      imageWidth: 800,
      imageHeight: 600,
      parsedOptionCount: 4,
    });
    expect(flags).toContain("has_formula");
  });

  it("flags ASCII formulas and sparse diagram-like OCR output", () => {
    const flags = classifyQuestion({
      rawText: "Solve x^2 = 4\nA. 2\nB. 4",
      confidence: 0.95,
      imageWidth: 1200,
      imageHeight: 700,
      parsedOptionCount: 2,
      textCoverage: 0.005,
      lineCount: 3,
    });
    expect(flags).toContain("has_formula");
    expect(flags).toContain("possible_graph_or_diagram");
  });

  it("flags an invalid number of detected options", () => {
    const flags = classifyQuestion({
      rawText: "Choose one\nA. Only answer",
      confidence: 0.95,
      imageWidth: 1200,
      imageHeight: 700,
      parsedOptionCount: 1,
    });
    expect(flags).toContain("missing_option_labels");
  });

  it("flags missing options", () => {
    const flags = classifyQuestion({
      rawText: "What is this?",
      confidence: 0.9,
      imageWidth: 800,
      imageHeight: 600,
      parsedOptionCount: 0,
    });
    expect(flags).toContain("missing_option_labels");
    expect(flags).toContain("too_short");
  });

  it("returns no flags for clean questions", () => {
    const flags = classifyQuestion({
      rawText: "What is the capital of France?\nA. Paris\nB. London",
      confidence: 0.95,
      imageWidth: 800,
      imageHeight: 600,
      parsedOptionCount: 2,
    });
    expect(flags).toHaveLength(0);
  });
});

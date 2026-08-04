import { describe, expect, it } from "vitest";
import {
  parseQuestionLayout,
  type OcrLayoutLine,
} from "./ocr-layout-parser.js";

function line(
  text: string,
  left: number,
  top: number,
  width = 0.3,
): OcrLayoutLine {
  return {
    text,
    confidence: 0.98,
    box: { left, top, width, height: 0.025 },
  };
}

describe("parseQuestionLayout", () => {
  it("ignores a full-screen answer sidebar and selects the real question panel", () => {
    const result = parseQuestionLayout([
      line(
        "There are 50 questions, and your progress of answering is",
        0.12,
        0.06,
        0.42,
      ),
      line("Answer", 0.02, 0.11),
      line("A", 0.03, 0.15),
      line("B", 0.03, 0.19),
      line("C", 0.03, 0.23),
      line("D", 0.03, 0.27),
      line(
        "Which item would most likely NOT be part of a basic communication plan:",
        0.4,
        0.11,
        0.45,
      ),
      line("A. Who are project stakeholders.", 0.4, 0.16, 0.34),
      line(
        "B. What are information needs of each stakeholder.",
        0.4,
        0.2,
        0.42,
      ),
      line("C. When will stakeholders gain promotion.", 0.4, 0.24, 0.38),
      line("D. Where is the space for the communication.", 0.4, 0.28, 0.4),
      line("Back", 0.02, 0.4),
      line("Next", 0.07, 0.4),
    ]);

    expect(result.stem).toBe(
      "Which item would most likely NOT be part of a basic communication plan:",
    );
    expect(result.options).toEqual([
      "Who are project stakeholders.",
      "What are information needs of each stakeholder.",
      "When will stakeholders gain promotion.",
      "Where is the space for the communication.",
    ]);
    expect(result.rawText).not.toContain("There are 50 questions");
    expect(result.rawText).not.toContain("Back");
  });

  it("accepts a two-option true or false question", () => {
    const result = parseQuestionLayout([
      line("True or False: A project is temporary.", 0.03, 0.08, 0.52),
      line("A. True", 0.03, 0.14),
      line("B. False", 0.03, 0.18),
    ]);

    expect(result.optionCount).toBe(2);
    expect(result.options).toEqual(["True", "False"]);
  });

  it("returns a retry crop instead of inventing options for a malformed image", () => {
    const result = parseQuestionLayout([
      line("Question: 8", 0.4, 0.1),
      line("Which statement is correct?", 0.4, 0.14),
      line("The answer labels are cut off by the screenshot.", 0.4, 0.18),
    ]);

    expect(result.options).toEqual([]);
    expect(result.crop).toMatchObject({ left: expect.any(Number) });
  });
});

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

  it("removes the standard exam header from the text stem", () => {
    const result = normalizeQuestionText(`MULTIPLE CHOICE
What is the response for GET /cats in this NestJS controller?
A. ['cat1', 'cat2']
B. Array of resources if route matched
C. Standard response from controller method
D. Empty`);

    expect(result.stem).toBe(
      "What is the response for GET /cats in this NestJS controller?",
    );
    expect(result.options).toEqual([
      "['cat1', 'cat2']",
      "Array of resources if route matched",
      "Standard response from controller method",
      "Empty",
    ]);
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

  it("accepts common Textract labels in a six-option question", () => {
    const rawText = `Choose all correct answers
(A) First
[B] Second
C: Third
D - Fourth
E) Fifth
F. Sixth`;
    const result = normalizeQuestionText(rawText);

    expect(result.stem).toBe("Choose all correct answers");
    expect(result.options).toEqual([
      "First",
      "Second",
      "Third",
      "Fourth",
      "Fifth",
      "Sixth",
    ]);
    expect(result.optionCount).toBe(6);
  });

  it("joins a label-only line with the option text emitted on the next line", () => {
    const result = normalizeQuestionText(
      "Choose one\nA\nFirst option\nB\nSecond option",
    );

    expect(result.stem).toBe("Choose one");
    expect(result.options).toEqual(["First option", "Second option"]);
  });

  it("splits multiple labelled options emitted in one Textract line", () => {
    const result = normalizeQuestionText(
      "Choose one A. First answer B. Second answer C. Third answer",
    );

    expect(result.stem).toBe("Choose one");
    expect(result.options).toEqual([
      "First answer",
      "Second answer",
      "Third answer",
    ]);
  });

  it("does not treat a question beginning with A as option A", () => {
    const result = normalizeQuestionText(`Question: 6
A project is plagued by requested changes to the project charter. Who has the primary responsibility to decide
if these changes are necessary?
(Choose 1 answer)
A. The project manager
B. The project team
C. The sponsor
D. The stakeholders`);

    expect(result.stem).toBe(
      "A project is plagued by requested changes to the project charter. Who has the primary responsibility to decide\nif these changes are necessary?",
    );
    expect(result.options).toEqual([
      "The project manager",
      "The project team",
      "The sponsor",
      "The stakeholders",
    ]);
  });

  it("removes page labels and choice instructions emitted between options", () => {
    const result = normalizeQuestionText(`Question: 4
Which one is not project manager's role?
A. A builder of teams
Choose 1 answer)
B. A motivator of people
C. A conflict resolution expert
D. A skilled communicator
E. A great solution architect`);

    expect(result.stem).toBe("Which one is not project manager's role?");
    expect(result.options).toEqual([
      "A builder of teams",
      "A motivator of people",
      "A conflict resolution expert",
      "A skilled communicator",
      "A great solution architect",
    ]);
  });
});

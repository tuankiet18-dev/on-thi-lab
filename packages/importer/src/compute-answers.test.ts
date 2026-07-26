import { describe, expect, it } from "vitest";
import { computeAnswer, parseCommunityAnswer } from "./compute-answers";

describe("community answer aggregation", () => {
  it("parses exact multi-answer sets and explicit Vietnamese answers", () => {
    expect(parseCommunityAnswer("ab")).toEqual(["a", "b"]);
    expect(parseCommunityAnswer("Đáp án đúng là A, C, D")).toEqual([
      "a",
      "c",
      "d",
    ]);
  });

  it("does not infer a multi-answer set from an explanation on later lines", () => {
    expect(parseCommunityAnswer("A\nD là phương án sai.")).toEqual(["a"]);
    expect(parseCommunityAnswer("Theo mình là A và D")).toBeNull();
  });

  it("aggregates exact sets, de-duplicates authors, and records evidence only", () => {
    const result = computeAnswer(1, [
      { author: "one", content: "AB" },
      { author: "two", content: "A B" },
      { author: "one", content: "AB" },
      { author: "three", content: "C" },
      { author: "four", content: "Mình chưa chắc" },
    ]);

    expect(result).toMatchObject({
      answers: ["a", "b"],
      proposedType: "multiple",
      optionCount: 4,
      totalComments: 5,
      validVotes: 3,
      confidence: 2 / 3,
      disputed: true,
      voteBreakdown: { ab: 2, c: 1 },
    });
  });
});

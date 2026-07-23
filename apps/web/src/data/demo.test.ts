import { examSchema } from "@onthilab/contracts";
import { describe, expect, it } from "vitest";
import { demoAnswerKey, demoExam } from "./demo";

describe("demo exam fixture", () => {
  it("matches the public exam contract", () => {
    expect(examSchema.safeParse(demoExam).success).toBe(true);
  });

  it("has an answer key for every question", () => {
    expect(Object.keys(demoAnswerKey).sort()).toEqual(
      demoExam.questions.map((question) => question.id).sort(),
    );
  });
});

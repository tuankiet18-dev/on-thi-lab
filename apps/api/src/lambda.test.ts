import { describe, expect, it } from "vitest";
import { isBinaryResponseContentType } from "./lambda";

describe("Lambda binary response detection", () => {
  it("marks all image responses as binary, including WebP", () => {
    expect(isBinaryResponseContentType("image/webp")).toBe(true);
    expect(isBinaryResponseContentType("image/png; charset=utf-8")).toBe(true);
  });

  it("keeps JSON and text responses non-binary", () => {
    expect(isBinaryResponseContentType("application/json")).toBe(false);
    expect(isBinaryResponseContentType("text/plain; charset=utf-8")).toBe(
      false,
    );
  });
});

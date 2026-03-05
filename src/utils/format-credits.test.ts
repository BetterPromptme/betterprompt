import { describe, expect, it } from "bun:test";
import formatCredits from "./format-credits";

describe("formatCredits", () => {
  it("formats credits without scaling", () => {
    expect(formatCredits(1_250_000)).toBe("1,250,000.0");
  });

  it("keeps one decimal place", () => {
    expect(formatCredits(42)).toBe("42.0");
  });
});

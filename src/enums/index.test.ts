import { describe, expect, it } from "bun:test";
import { PART_TYPE } from "./index";

describe("PART_TYPE enum", () => {
  it("uses stable string values for every part type", () => {
    expect(String(PART_TYPE.TEXT)).toBe("text");
    expect(String(PART_TYPE.IMAGE)).toBe("image");
    expect(String(PART_TYPE.ERROR)).toBe("error");
    expect(String(PART_TYPE.VIDEO)).toBe("video");
  });
});

import { describe, expect, it } from "bun:test";
import { CONFIG_MESSAGES } from "./config";

describe("CONFIG_MESSAGES", () => {
  it("includes API key setup guidance in help text", () => {
    expect(CONFIG_MESSAGES.helpText).toContain(
      "Get an API key: https://betterprompt.me/api-keys"
    );
  });
});

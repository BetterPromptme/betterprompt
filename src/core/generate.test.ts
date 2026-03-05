import { describe, expect, it, mock } from "bun:test";
import { resolveInputs } from "./generate";

describe("resolveInputs", () => {
  it("applies precedence: --input > --stdin > defaults", async () => {
    const result = await resolveInputs({
      input: ["topic=from-input", "length=long"],
      stdinJson: '{"topic":"from-stdin","tone":"friendly"}',
      defaults: {
        topic: "from-default",
        tone: "neutral",
        audience: "developers",
      },
    });

    expect(result.inputs).toEqual({
      topic: "from-input",
      length: "long",
      tone: "friendly",
      audience: "developers",
    });
  });

  it("overrides the same key from --stdin with --input", async () => {
    const result = await resolveInputs({
      input: ["tone=formal"],
      stdinJson: '{"tone":"casual","topic":"ai"}',
      defaults: {},
    });

    expect(result.inputs).toEqual({
      tone: "formal",
      topic: "ai",
    });
  });

  it("fills missing required fields via --interactive prompt", async () => {
    const promptForMissing = mock(async (fields: string[]) => {
      expect(fields).toEqual(["tone"]);
      return { tone: "professional" };
    });

    const result = await resolveInputs({
      input: ["topic=prompt-engineering"],
      defaults: {},
      interactive: true,
      schema: {
        type: "object",
        required: ["topic", "tone"],
        properties: {
          topic: { type: "string" },
          tone: { type: "string" },
        },
      },
      promptForMissing,
    });

    expect(promptForMissing).toHaveBeenCalledTimes(1);
    expect(result.inputs).toEqual({
      topic: "prompt-engineering",
      tone: "professional",
    });
  });

  it("passes schema validation for valid resolved inputs", async () => {
    await expect(
      resolveInputs({
        input: ["topic=cli-testing", "tone=clear"],
        schema: {
          type: "object",
          required: ["topic", "tone"],
          properties: {
            topic: { type: "string", minLength: 3 },
            tone: { type: "string", minLength: 3 },
          },
        },
      })
    ).resolves.toMatchObject({
      inputs: {
        topic: "cli-testing",
        tone: "clear",
      },
    });
  });

  it("returns field-level validation details when schema validation fails", async () => {
    await expect(
      resolveInputs({
        input: ["topic=ok", "tone=1"],
        schema: {
          type: "object",
          required: ["topic", "tone"],
          properties: {
            topic: { type: "string", minLength: 2 },
            tone: { type: "string", minLength: 3 },
          },
        },
      })
    ).rejects.toMatchObject({
      message: "Input validation failed.",
      details: [
        {
          field: "tone",
        },
      ],
    });
  });

  it("skips schema validation when no schema is provided", async () => {
    const result = await resolveInputs({
      input: ["topic=no-schema"],
      defaults: { tone: "neutral" },
    });

    expect(result.inputs).toEqual({
      topic: "no-schema",
      tone: "neutral",
    });
  });
});

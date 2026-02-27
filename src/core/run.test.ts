import { describe, expect, it, mock } from "bun:test";
import {
  createRun,
  parseInputsJson,
  parseRunOptionsJson,
  validateRunPayload,
} from "./run";
import { RunStatus } from "../enums/run-status";
import type { TRunPayload } from "../types/run";

describe("validateRunPayload", () => {
  it("passes with inputs", () => {
    expect(() =>
      validateRunPayload({ promptVersionId: "uuid-1", inputs: {} })
    ).not.toThrow();
  });

  it("throws when promptVersionId is empty", () => {
    expect(() =>
      validateRunPayload({ promptVersionId: "", inputs: {} })
    ).toThrow("promptVersionId must not be empty.");
  });

  it("throws when promptVersionId is whitespace only", () => {
    expect(() =>
      validateRunPayload({ promptVersionId: "   ", inputs: {} })
    ).toThrow("promptVersionId must not be empty.");
  });

  it("throws when inputs is not provided", () => {
    expect(() => validateRunPayload({ promptVersionId: "uuid-1" })).toThrow(
      "You must provide --inputs."
    );
  });
});

describe("parseInputsJson", () => {
  it("parses valid JSON with textInputs and imageInputs", () => {
    const result = parseInputsJson(
      '{"textInputs":{"key":"value"},"imageInputs":[{"type":"url","url":"https://x.com/a.png"}]}'
    );
    expect(result).toEqual({
      textInputs: { key: "value" },
      imageInputs: [{ type: "url", url: "https://x.com/a.png" }],
    });
  });

  it("parses inputs with only textInputs", () => {
    const result = parseInputsJson('{"textInputs":{"name":"Alice"}}');
    expect(result).toEqual({ textInputs: { name: "Alice" } });
  });

  it("parses an empty object (both fields optional)", () => {
    const result = parseInputsJson("{}");
    expect(result).toEqual({});
  });

  it("throws on invalid JSON", () => {
    expect(() => parseInputsJson("not-json")).toThrow(
      "inputs must be a valid JSON object."
    );
  });

  it("throws when value is not an object", () => {
    expect(() => parseInputsJson('"string"')).toThrow(
      "inputs must be a valid JSON object."
    );
  });

  it("throws when value is an array", () => {
    expect(() => parseInputsJson("[]")).toThrow(
      "inputs must be a valid JSON object."
    );
  });
});

describe("parseRunOptionsJson", () => {
  it("returns undefined when value is undefined", () => {
    expect(parseRunOptionsJson(undefined)).toBeUndefined();
  });

  it("parses valid run options", () => {
    const result = parseRunOptionsJson(
      '{"reasoningEffort":"high","quality":"hd"}'
    );
    expect(result).toEqual({ reasoningEffort: "high", quality: "hd" });
  });

  it("parses partial run options", () => {
    const result = parseRunOptionsJson('{"seconds":"30"}');
    expect(result).toEqual({ seconds: "30" });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseRunOptionsJson("bad-json")).toThrow(
      "runOptions must be a valid JSON object."
    );
  });

  it("throws when value is not an object", () => {
    expect(() => parseRunOptionsJson('"string"')).toThrow(
      "runOptions must be a valid JSON object."
    );
  });
});

describe("createRun", () => {
  it("calls POST /runs with a structured inputs payload", async () => {
    const payload: TRunPayload = {
      promptVersionId: "uuid-123",
      inputs: { textInputs: { name: "Alice" } },
    };

    const mockResult = {
      status: "SUCCESS",
      data: { runId: "run-1", outputs: {}, runStatus: RunStatus.Succeeded },
    };

    const apiClient = {
      post: mock(async () => mockResult),
    } as Parameters<typeof createRun>[0];

    const result = await createRun(apiClient, payload);

    expect(apiClient.post).toHaveBeenCalledWith("/runs", payload);
    expect(result).toEqual(mockResult);
  });

  it("includes optional runModel and runOptions when provided", async () => {
    const payload: TRunPayload = {
      promptVersionId: "uuid-123",
      inputs: { textInputs: {} },
      runModel: "gpt-4o",
      runOptions: { reasoningEffort: "high", quality: "hd" },
    };

    const apiClient = {
      post: mock(async () => ({
        status: "SUCCESS",
        data: { runId: "run-2", outputs: null, runStatus: RunStatus.Succeeded },
      })),
    } as Parameters<typeof createRun>[0];

    await createRun(apiClient, payload);

    expect(apiClient.post).toHaveBeenCalledWith("/runs", payload);
  });
});

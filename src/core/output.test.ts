import { describe, expect, it } from "bun:test";

type TOutputFormat = "text" | "json";

type TPrintContext = {
  outputFormat: TOutputFormat;
};

type TPrintResult = (data: unknown, ctx: TPrintContext) => void;

type TLogCall = {
  args: unknown[];
};

const loadPrintResult = async (): Promise<TPrintResult> => {
  const outputModulePath = "./output";
  const outputModule: unknown = await import(outputModulePath);

  if (
    typeof outputModule !== "object" ||
    outputModule === null ||
    !("printResult" in outputModule)
  ) {
    throw new Error("printResult export was not found in src/core/output.ts");
  }

  const printResult = (outputModule as { printResult: unknown }).printResult;
  if (typeof printResult !== "function") {
    throw new Error("printResult must be a function");
  }

  return printResult as TPrintResult;
};

const withCapturedLog = async (run: () => void | Promise<void>): Promise<TLogCall[]> => {
  const calls: TLogCall[] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    calls.push({ args });
  };

  try {
    await run();
  } finally {
    console.log = originalLog;
  }

  return calls;
};

const getSingleLoggedString = (calls: TLogCall[]): string => {
  expect(calls).toHaveLength(1);
  expect(calls[0]?.args).toHaveLength(1);

  const loggedValue = calls[0]?.args[0];
  expect(typeof loggedValue).toBe("string");

  return loggedValue as string;
};

describe("printResult", () => {
  it("outputs valid JSON to stdout when outputFormat is json", async () => {
    const printResult = await loadPrintResult();
    const payload = {
      ok: true,
      count: 2,
      items: [{ id: "a" }, { id: "b" }],
    };

    const calls = await withCapturedLog(() =>
      printResult(payload, { outputFormat: "json" })
    );

    const output = getSingleLoggedString(calls);
    expect(JSON.parse(output)).toEqual(payload);
  });

  it("outputs formatted text in default text mode", async () => {
    const printResult = await loadPrintResult();
    const payload = {
      title: "Release notes",
      total: 3,
    };

    const calls = await withCapturedLog(() =>
      printResult(payload, { outputFormat: "text" })
    );

    const output = getSingleLoggedString(calls);
    expect(output.length).toBeGreaterThan(0);
    expect(output).toContain("Release notes");
    expect(output).toContain("3");
  });

  it("handles null data in json and text modes", async () => {
    const printResult = await loadPrintResult();

    const jsonCalls = await withCapturedLog(() =>
      printResult(null, { outputFormat: "json" })
    );
    const jsonOutput = getSingleLoggedString(jsonCalls);
    expect(JSON.parse(jsonOutput)).toBeNull();

    const textCalls = await withCapturedLog(() =>
      printResult(null, { outputFormat: "text" })
    );
    const textOutput = getSingleLoggedString(textCalls);
    expect(textOutput.length).toBeGreaterThan(0);
  });

  it("handles nested objects and arrays", async () => {
    const printResult = await loadPrintResult();
    const payload = {
      meta: {
        page: 1,
        total: 2,
      },
      rows: [
        { id: "r1", tags: ["a", "b"] },
        { id: "r2", tags: ["c"] },
      ],
    };

    const textCalls = await withCapturedLog(() =>
      printResult(payload, { outputFormat: "text" })
    );
    const textOutput = getSingleLoggedString(textCalls);
    expect(textOutput).toContain("meta");
    expect(textOutput).toContain("rows");
    expect(textOutput).toContain("r1");

    const jsonCalls = await withCapturedLog(() =>
      printResult(payload, { outputFormat: "json" })
    );
    const jsonOutput = getSingleLoggedString(jsonCalls);
    expect(JSON.parse(jsonOutput)).toEqual(payload);
  });

  it("passes string data through unchanged in text mode", async () => {
    const printResult = await loadPrintResult();
    const message = "Operation completed successfully.";

    const calls = await withCapturedLog(() =>
      printResult(message, { outputFormat: "text" })
    );

    const output = getSingleLoggedString(calls);
    expect(output).toBe(message);
  });

  it("serializes undefined safely in both modes", async () => {
    const printResult = await loadPrintResult();

    const jsonCalls = await withCapturedLog(() =>
      printResult(undefined, { outputFormat: "json" })
    );
    const jsonOutput = getSingleLoggedString(jsonCalls);
    expect(jsonOutput).toBe("null");

    const textCalls = await withCapturedLog(() =>
      printResult(undefined, { outputFormat: "text" })
    );
    const textOutput = getSingleLoggedString(textCalls);
    expect(textOutput).toBe("null");
  });

  it("renders primitives consistently across modes", async () => {
    const printResult = await loadPrintResult();

    const textCalls = await withCapturedLog(() =>
      printResult(42, { outputFormat: "text" })
    );
    expect(getSingleLoggedString(textCalls)).toBe("42");

    const jsonCalls = await withCapturedLog(() =>
      printResult(false, { outputFormat: "json" })
    );
    expect(getSingleLoggedString(jsonCalls)).toBe("false");
  });
});

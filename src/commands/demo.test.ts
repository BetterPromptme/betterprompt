import { afterEach, describe, expect, it, mock } from "bun:test";
import { demoCommand } from "./demo";

const stripAnsi = (value: string): string => {
  let output = "";
  let index = 0;

  while (index < value.length) {
    if (value.charCodeAt(index) === 27 && value[index + 1] === "[") {
      index += 2;

      while (index < value.length && !/[A-Za-z]/.test(value[index])) {
        index += 1;
      }

      if (index < value.length) {
        index += 1;
      }
      continue;
    }

    output += value[index];
    index += 1;
  }

  return output;
};
const originalConsoleLog = console.log;

const runDemo = async (args: string[]) => {
  await demoCommand.parseAsync(args, { from: "user" });
};

const getLoggedLine = (call: unknown[]): string => {
  const [value] = call;
  return typeof value === "string" ? value : String(value ?? "");
};

describe("demo command", () => {
  afterEach(() => {
    console.log = originalConsoleLog;
    mock.restore();
  });

  it("prints default message once when no args are provided", async () => {
    const logSpy = mock((..._args: unknown[]) => {});
    console.log = logSpy;

    await runDemo([]);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = getLoggedLine(logSpy.mock.calls[0] ?? []);
    const output = stripAnsi(line);

    expect(output).toContain("Demo run 1/1:");
    expect(output).toContain("hello from betterprompt demo");
  });

  it("prints the custom message the requested number of times", async () => {
    const logSpy = mock((..._args: unknown[]) => {});
    console.log = logSpy;

    await runDemo(["smoke test", "--repeat", "3"]);

    expect(logSpy).toHaveBeenCalledTimes(3);
    const output = logSpy.mock.calls.map((call) => stripAnsi(getLoggedLine(call)));

    expect(output[0]).toContain("Demo run 1/3:");
    expect(output[1]).toContain("Demo run 2/3:");
    expect(output[2]).toContain("Demo run 3/3:");
    expect(output.every((line) => line.includes("smoke test"))).toBe(true);
  });

  it("fails when repeat exceeds the allowed maximum", async () => {
    console.log = mock(() => {});

    await expect(runDemo(["hello", "--repeat", "11"])).rejects.toThrow();
  });
});

import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { getCommandContext } from "../core/context";
import { runTaskWithSpinner } from "../core/error-ux";
import { printResult } from "../core/output";
import { runDoctorChecks } from "../core/doctor";
import type {
  TDoctorCommandDependencies,
  TDoctorCommandOptions,
  TDoctorResult,
} from "../types/doctor";

const DOCTOR_FAILED_PREFIX = "Doctor command failed:";

const formatTextResult = (result: TDoctorResult): string => {
  const statusLine = result.healthy
    ? `${logSymbols.success} Doctor checks passed`
    : `${logSymbols.warning} Doctor checks found issues`;

  const checkLines = result.checks.map((check) => {
    const marker = check.status === "pass" ? "PASS" : "FAIL";
    const fixedSuffix = check.fixed === true ? " (fixed)" : "";
    return `- ${check.name}: ${marker}${fixedSuffix} - ${check.message}`;
  });

  return [statusLine, ...checkLines].join("\n");
};

const defaultDeps: TDoctorCommandDependencies = {
  runDoctorChecks: (options) => runDoctorChecks(options),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createDoctorCommand = (
  deps: TDoctorCommandDependencies = defaultDeps
): Command =>
  new Command("doctor")
    .description("Run health checks for BetterPrompt environment")
    .option("--fix", "Attempt to fix remediable problems")
    .option("--json", "Render output as JSON")
    .action(async (opts: TDoctorCommandOptions, command: Command) => {
      try {
        const ctx = getCommandContext(command);
        const result = await runTaskWithSpinner({
          message: "Running doctor checks...",
          createSpinner: (message) => ora({ text: message, isEnabled: process.stderr.isTTY }),
          task: () =>
            deps.runDoctorChecks({
              fix: opts.fix === true,
            }),
        });

        if (ctx.outputFormat === "json") {
          deps.printResult(result, ctx);
        } else {
          deps.printResult(formatTextResult(result), ctx);
        }

        if (!result.healthy) {
          deps.setExitCode(1);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        deps.error(`${logSymbols.error} ${DOCTOR_FAILED_PREFIX} ${errorMessage}`);
        deps.setExitCode(1);
      }
    });

export const doctorCommand = createDoctorCommand();

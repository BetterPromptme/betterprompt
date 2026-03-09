import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { DOCTOR_COMMAND, DOCTOR_MESSAGES } from "../../constants";
import { getCommandContext } from "../../services/context/service";
import { runTaskWithSpinner } from "../../services/error-ux/service";
import { printResult } from "../../services/output/service";
import { runDoctorChecks } from "../../services/doctor/service";
import type {
  TDoctorCommandDependencies,
  TDoctorCommandOptions,
  TDoctorResult,
} from "./types";

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
  new Command(DOCTOR_COMMAND.name)
    .description(DOCTOR_COMMAND.description)
    .option(DOCTOR_COMMAND.flags.fix.flag, DOCTOR_COMMAND.flags.fix.description)
    .option(DOCTOR_COMMAND.flags.json.flag, DOCTOR_COMMAND.flags.json.description)
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
        deps.error(`${logSymbols.error} ${DOCTOR_MESSAGES.failedPrefix} ${errorMessage}`);
        deps.setExitCode(1);
      }
    });

export const doctorCommand = createDoctorCommand();

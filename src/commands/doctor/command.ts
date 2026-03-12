import logSymbols from "log-symbols";

import { DOCTOR_COMMAND, DOCTOR_MESSAGES } from "../../constants";
import { createCommandFromSpec } from "../../services/command-factory/service";
import { runDoctorChecks } from "../../services/doctor/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
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
};

export const createDoctorCommand = (
  deps: TDoctorCommandDependencies = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec<TDoctorCommandOptions>(
    {
      name: DOCTOR_COMMAND.name,
      description: DOCTOR_COMMAND.description,
      flags: DOCTOR_COMMAND.flags,
      spinnerMessage: "Running doctor checks...",
      errorPrefix: `${logSymbols.error} ${DOCTOR_MESSAGES.failedPrefix}`,
      handler: async ({ opts, setExitCode }) => {
        const result = await deps.runDoctorChecks({ fix: opts.fix === true });
        if (!result.healthy) {
          setExitCode(1);
        }
        return result;
      },
      formatText: (result) => formatTextResult(result as TDoctorResult),
    },
    factoryDeps
  );

export const doctorCommand = createDoctorCommand();

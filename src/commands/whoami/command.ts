import chalk from "chalk";
import { Command } from "commander";
import logSymbols from "log-symbols";
import ora from "ora";
import { WHOAMI_COMMAND, WHOAMI_MESSAGES } from "../../constants";
import { getApiClient } from "../../services/api/client";
import { getCurrentUser } from "../../services/auth/service";
import { getCommandContext } from "../../services/context/service";
import { runTaskWithSpinner } from "../../services/error-ux/service";
import { printResult } from "../../services/output/service";
import type { TUserIdentity, TWhoamiDependencies } from "./types";

const formatIdentityText = (identity: TUserIdentity): string =>
  [
    `${logSymbols.info} ${chalk.bold.cyan("Username:")}     ${chalk.white(identity.username)}`,
    `  ${chalk.bold.cyan("Display Name:")} ${chalk.white(identity.displayName)}`,
    `  ${chalk.bold.cyan("User Flags:")}   ${chalk.yellow(String(identity.userFlags))}`,
  ].join("\n");

const defaultDeps: TWhoamiDependencies = {
  getCurrentUser: () => getCurrentUser(getApiClient()),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createWhoamiCommand = (
  deps: TWhoamiDependencies = defaultDeps
): Command => {
  const command = new Command(WHOAMI_COMMAND.name).description(
    WHOAMI_COMMAND.description
  );
  command.option(WHOAMI_COMMAND.flags.json.flag, WHOAMI_COMMAND.flags.json.description);

  command.action(async (_opts: Record<string, unknown>, command: Command) => {
    try {
      const ctx = getCommandContext(command);
      const identity = await runTaskWithSpinner({
        message: "Fetching account identity...",
        createSpinner: (message) => ora({ text: message, isEnabled: process.stderr.isTTY }),
        task: () => deps.getCurrentUser(),
      });
      deps.printResult(
        ctx.outputFormat === "json" ? identity : formatIdentityText(identity),
        ctx
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? WHOAMI_MESSAGES.unknownError);
      deps.error(`${logSymbols.error} ${WHOAMI_MESSAGES.failedPrefix} ${message}`);
      deps.setExitCode(1);
    }
  });

  return command;
};

export const whoamiCommand = createWhoamiCommand();

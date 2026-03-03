import { Command } from "commander";
import logSymbols from "log-symbols";
import { CREDITS_COMMAND, CREDITS_MESSAGES } from "../constants";
import { getApiClient } from "../core/api";
import { getCredits } from "../core/auth";
import { getCommandContext } from "../core/context";
import { printResult } from "../core/output";
import type { TCreditBalance, TCreditsDependencies } from "../types";

const formatCreditsText = (credits: TCreditBalance): string =>
  [
    `${logSymbols.info} Balance:    ${credits.balance}`,
    `  Currency:   ${credits.currency}`,
    `  Updated At: ${credits.updatedAt}`,
  ].join("\n");

const defaultDeps: TCreditsDependencies = {
  getCredits: () => getCredits(getApiClient()),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createCreditsCommand = (
  deps: TCreditsDependencies = defaultDeps
): Command => {
  const command = new Command(CREDITS_COMMAND.name).description(
    CREDITS_COMMAND.description
  );
  command.option("--json", "Render output as JSON");

  command.action(async (_opts: Record<string, unknown>, command: Command) => {
    try {
      const ctx = getCommandContext(command);
      const credits = await deps.getCredits();
      deps.printResult(
        ctx.outputFormat === "json" ? credits : formatCreditsText(credits),
        ctx
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? CREDITS_MESSAGES.unknownError);
      deps.error(`${logSymbols.error} ${CREDITS_MESSAGES.failedPrefix} ${message}`);
      deps.setExitCode(1);
    }
  });

  return command;
};

export const creditsCommand = createCreditsCommand();

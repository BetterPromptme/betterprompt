import { confirm } from "@clack/prompts";
import logSymbols from "log-symbols";

import { RESET_COMMAND, RESET_MESSAGES } from "../../constants";
import { createCommandFromSpec } from "../../services/command-factory/service";
import { runReset as runResetService } from "../../services/reset/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type { TResetCommandDependencies } from "./types";

const defaultDeps: TResetCommandDependencies = {
  confirmReset: async () => {
    const response = await confirm({
      message: RESET_MESSAGES.confirmMessage,
      initialValue: false,
    });
    return response === true;
  },
  runReset: async (options) => runResetService(options),
};

export const createResetCommand = (
  deps: TResetCommandDependencies = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec(
    {
      name: RESET_COMMAND.name,
      description: RESET_COMMAND.description,
      flags: RESET_COMMAND.flags,
      errorPrefix: `${logSymbols.error} ${RESET_MESSAGES.failedPrefix}`,
      handler: async ({ ctx }) => {
        const confirmed = ctx.yes ? true : await deps.confirmReset();
        if (!confirmed) {
          return RESET_MESSAGES.cancelled;
        }
        return deps.runReset({ force: true });
      },
      formatText: (result) => {
        if (typeof result === "string") return result;
        return `${logSymbols.success} ${RESET_MESSAGES.success}`;
      },
    },
    factoryDeps
  );

export const resetCommand = createResetCommand();

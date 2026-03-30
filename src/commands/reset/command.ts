import { confirm } from "@clack/prompts";
import logSymbols from "log-symbols";

import {
  RESET_COMMAND,
  RESET_MESSAGES,
  TELEMETRY_COMMANDS,
} from "../../constants";
import { createCommandFromSpec } from "../../services/command-factory/service";
import { runReset as runResetService } from "../../services/reset/service";
import { track } from "../../services/telemetry/service";
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
        const start = performance.now();
        const confirmed = ctx.yes ? true : await deps.confirmReset();
        if (!confirmed) {
          void track({
            command: TELEMETRY_COMMANDS.reset,
            startedAt: start,
            metadata: {},
          });
          return RESET_MESSAGES.cancelled;
        }
        const result = await deps.runReset({ force: true });
        void track({
          command: TELEMETRY_COMMANDS.reset,
          startedAt: start,
          metadata: {},
        });
        return result;
      },
      formatText: (result) => {
        if (typeof result === "string") return result;
        return `${logSymbols.success} ${RESET_MESSAGES.success}`;
      },
    },
    factoryDeps
  );

export const resetCommand = createResetCommand();

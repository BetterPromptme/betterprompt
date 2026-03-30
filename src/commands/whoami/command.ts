import chalk from "chalk";
import logSymbols from "log-symbols";

import {
  TELEMETRY_COMMANDS,
  WHOAMI_COMMAND,
  WHOAMI_MESSAGES,
} from "../../constants";
import { getApiClient } from "../../services/api/client";
import { getCurrentUser } from "../../services/auth/service";
import { createCommandFromSpec } from "../../services/command-factory/service";
import { track } from "../../services/telemetry/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import type { TUserIdentity, TWhoamiDependencies } from "./types";

const formatIdentityText = (identity: TUserIdentity): string =>
  [
    `${logSymbols.info} ${chalk.bold.cyan("Username:")}     ${chalk.white(identity.username)}`,
    `  ${chalk.bold.cyan("Display Name:")} ${chalk.white(identity.displayName)}`,
    `  ${chalk.bold.cyan("User Flags:")}   ${chalk.yellow(String(identity.userFlags))}`,
  ].join("\n");

const defaultDeps: TWhoamiDependencies = {
  getCurrentUser: () => getCurrentUser(getApiClient()),
};

export const createWhoamiCommand = (
  deps: TWhoamiDependencies = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec<Record<string, unknown>>(
    {
      name: WHOAMI_COMMAND.name,
      description: WHOAMI_COMMAND.description,
      flags: WHOAMI_COMMAND.flags,
      spinnerMessage: "Fetching account identity...",
      errorPrefix: `${logSymbols.error} ${WHOAMI_MESSAGES.failedPrefix}`,
      handler: async () => {
        const start = performance.now();
        const result = await deps.getCurrentUser();
        void track({
          command: TELEMETRY_COMMANDS.whoami,
          startedAt: start,
          metadata: {},
        });
        return result;
      },
      formatText: (result) => formatIdentityText(result as TUserIdentity),
    },
    factoryDeps
  );

export const whoamiCommand = createWhoamiCommand();

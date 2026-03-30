import logSymbols from "log-symbols";

import {
  CREDITS_COMMAND,
  CREDITS_MESSAGES,
  TELEMETRY_COMMANDS,
} from "../../constants";
import { getApiClient } from "../../services/api/client";
import { getCredits } from "../../services/auth/service";
import { createCommandFromSpec } from "../../services/command-factory/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { formatCredits } from "../../utils/format-credits";
import type { TCreditBalance, TCreditsDependencies } from "./types";

const formatCreditsText = (credits: TCreditBalance): string =>
  `${logSymbols.info} Credits: ${formatCredits(credits.credits)}`;

const defaultDeps: TCreditsDependencies = {
  getCredits: () => getCredits(getApiClient()),
};

export const createCreditsCommand = (
  deps: TCreditsDependencies = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec(
    {
      name: CREDITS_COMMAND.name,
      description: CREDITS_COMMAND.description,
      flags: CREDITS_COMMAND.flags,
      spinnerMessage: "Fetching credits balance...",
      errorPrefix: `${logSymbols.error} ${CREDITS_MESSAGES.failedPrefix}`,
      telemetry: { command: TELEMETRY_COMMANDS.credits },
      handler: async () => {
        return deps.getCredits();
      },
      formatText: (result) => formatCreditsText(result as TCreditBalance),
    },
    factoryDeps
  );

export const creditsCommand = createCreditsCommand();

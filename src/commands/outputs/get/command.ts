import logSymbols from "log-symbols";

import { OUTPUTS_COMMAND, OUTPUTS_MESSAGES } from "../../../constants";
import { createCommandFromSpec } from "../../../services/command-factory/service";
import { fetchOutputRun } from "../../../services/outputs/service";
import type { TCommandFactoryDeps } from "../../../types/command-factory";
import type {
  TOutputsCommandDependencies,
  TOutputsCommandOptions,
} from "../../../types/outputs";
import type { TRunResult } from "../../../types/run";

export const formatRunOutputText = (result: unknown): string => {
  const run = result as TRunResult;
  const lines = [`${OUTPUTS_MESSAGES.runStatusPrefix} ${run.runStatus}`];
  const displayOutputs = run.outputs.map((part) => part.data);
  if (displayOutputs.length > 0) {
    lines.push(...displayOutputs);
  } else {
    lines.push(
      `${logSymbols.warning} ${OUTPUTS_MESSAGES.emptyMessagePrefix} ${run.runId}.`
    );
  }
  return lines.join("\n");
};

export const createOutputsGetSubcommand = (
  deps: TOutputsCommandDependencies,
  factoryDeps?: Partial<TCommandFactoryDeps>
) => {
  const outputsGet = OUTPUTS_COMMAND.subcommands.get;

  return createCommandFromSpec<TOutputsCommandOptions>(
    {
      name: outputsGet.name,
      description: outputsGet.description,
      arguments: [
        {
          name: outputsGet.arguments.runId.name,
          description: outputsGet.arguments.runId.description,
        },
      ],
      flags: outputsGet.flags,
      spinnerMessage: "Fetching output run...",
      errorPrefix: `${logSymbols.error} ${OUTPUTS_MESSAGES.failedPrefix}`,
      handler: async ({ opts, args, ctx, command }) => {
        const runId = args[outputsGet.arguments.runId.name] as string;
        const rootRemote =
          command.parent?.opts<{ remote?: boolean }>().remote === true;
        return fetchOutputRun(
          deps,
          runId,
          {
            ...opts,
            remote: opts.remote === true || rootRemote,
          },
          ctx
        );
      },
      formatText: formatRunOutputText,
    },
    factoryDeps
  );
};

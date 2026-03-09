import { Command } from "commander";
import logSymbols from "log-symbols";
import { RESOURCES_COMMAND, RESOURCES_MESSAGES } from "../../constants";
import { getApiClient } from "../../services/api/client";
import { getCommandContext } from "../../services/context/service";
import { printResult } from "../../services/output/service";
import {
  fetchResources,
  loadLocalResources,
  saveLocalResources,
} from "../../services/resources/service";
import type {
  TResourcesDependencies,
  TResourcesData,
  TResourceModel,
} from "./types";

const formatModelLine = (model: TResourceModel): string => {
  const header = `${logSymbols.info} ${model.model}  [${model.modality}]`;
  const runOptions =
    model.availableRunOptions.length > 0
      ? model.availableRunOptions
          .map(
            ({ key, options }) =>
              `${key}: ${options.length > 0 ? options.join(", ") : "none"}`
          )
          .join("  |  ")
      : "no run options";
  return `${header}\n    ${runOptions}`;
};

const formatResourcesText = (data: TResourcesData): string =>
  data.resources.models.map(formatModelLine).join("\n\n");

const formatModelsText = (models: TResourceModel[]): string =>
  models.map(formatModelLine).join("\n\n");

const defaultDeps: TResourcesDependencies = {
  fetchResources: (opts) =>
    fetchResources(
      opts?.skipModelsHash
        ? { get: (p) => getApiClient().get(p, { _skipModelsHash: true }) }
        : getApiClient()
    ),
  loadLocalResources: () => loadLocalResources(),
  saveLocalResources: (data) => saveLocalResources(data),
  printResult: (data, ctx) => printResult(data, ctx),
  error: (message) => console.error(message),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

export const createResourcesCommand = (
  deps: TResourcesDependencies = defaultDeps
): Command => {
  const command = new Command(RESOURCES_COMMAND.name).description(
    RESOURCES_COMMAND.description
  );
  command.option(
    RESOURCES_COMMAND.flags.remote.flag,
    RESOURCES_COMMAND.flags.remote.description
  );
  command.option(
    RESOURCES_COMMAND.flags.sync.flag,
    RESOURCES_COMMAND.flags.sync.description
  );
  command.option(
    RESOURCES_COMMAND.flags.modelsOnly.flag,
    RESOURCES_COMMAND.flags.modelsOnly.description
  );
  command.option(
    RESOURCES_COMMAND.flags.json.flag,
    RESOURCES_COMMAND.flags.json.description
  );

  command.action(async (_opts: Record<string, unknown>, command: Command) => {
    try {
      const ctx = getCommandContext(command);
      const opts = command.opts<{
        remote?: boolean;
        sync?: boolean;
        modelsOnly?: boolean;
      }>();

      let data: TResourcesData;

      if (opts.remote) {
        data = await deps.fetchResources({ skipModelsHash: true });
      } else if (opts.sync) {
        data = await deps.fetchResources({ skipModelsHash: true });
        await deps.saveLocalResources(data);
      } else {
        const local = await deps.loadLocalResources();
        if (local !== null) {
          data = local;
        } else {
          data = await deps.fetchResources();
          await deps.saveLocalResources(data);
        }
      }

      if (ctx.outputFormat === "json") {
        deps.printResult(opts.modelsOnly ? data.resources.models : data, ctx);
      } else {
        deps.printResult(
          opts.modelsOnly
            ? formatModelsText(data.resources.models)
            : formatResourcesText(data),
          ctx
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? RESOURCES_MESSAGES.unknownError);
      deps.error(
        `${logSymbols.error} ${RESOURCES_MESSAGES.failedPrefix} ${message}`
      );
      deps.setExitCode(1);
    }
  });

  return command;
};

export const resourcesCommand = createResourcesCommand();

import logSymbols from "log-symbols";
import { RESOURCES_COMMAND, RESOURCES_MESSAGES } from "../../constants";
import { getApiClient } from "../../services/api/client";
import { createCommandFromSpec } from "../../services/command-factory/service";
import {
  fetchResources,
  loadLocalResources,
  saveLocalResources,
} from "../../services/resources/service";
import type { TCommandFactoryDeps } from "../../types/command-factory";
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

const formatModelsText = (models: TResourceModel[]): string =>
  models.map(formatModelLine).join("\n\n");

type TSectionFormatter = (items: unknown) => string;

const sectionFormatters: Record<string, TSectionFormatter> = {
  models: (items) => formatModelsText(items as TResourceModel[]),
};

const formatResourcesText = (data: TResourcesData): string =>
  Object.entries(data.resources)
    .map(([section, items]) => {
      const formatter = sectionFormatters[section];
      const body = formatter
        ? formatter(items)
        : JSON.stringify(items, null, 2);
      return `${section}\n${body}`;
    })
    .join("\n\n");

type TResourcesOpts = {
  remote?: boolean;
  sync?: boolean;
  modelsOnly?: boolean;
};

const defaultDeps: TResourcesDependencies = {
  fetchResources: (opts) =>
    fetchResources(
      opts?.skipModelsHash
        ? { get: (p) => getApiClient().get(p, { _skipModelsHash: true }) }
        : getApiClient()
    ),
  loadLocalResources: () => loadLocalResources(),
  saveLocalResources: (data) => saveLocalResources(data),
};

export const createResourcesCommand = (
  deps: TResourcesDependencies = defaultDeps,
  factoryDeps?: Partial<TCommandFactoryDeps>
) =>
  createCommandFromSpec<TResourcesOpts>(
    {
      name: RESOURCES_COMMAND.name,
      description: RESOURCES_COMMAND.description,
      flags: RESOURCES_COMMAND.flags,
      errorPrefix: `${logSymbols.error} ${RESOURCES_MESSAGES.failedPrefix}`,
      validate: ({ opts }) => {
        if (opts.remote && opts.sync) {
          return RESOURCES_MESSAGES.remoteSyncMutuallyExclusive;
        }
        return undefined;
      },
      handler: async ({ opts }) => {
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
            data = await deps.fetchResources({ skipModelsHash: true });
            await deps.saveLocalResources(data);
          }
        }

        // In JSON mode, formatText is skipped — return filtered data for --models-only
        if (opts.modelsOnly) {
          return { kind: "models" as const, data: data.resources.models };
        }
        return { kind: "full" as const, data };
      },
      formatText: (result) => {
        const r = result as
          | { kind: "models"; data: TResourceModel[] }
          | { kind: "full"; data: TResourcesData };
        if (r.kind === "models") {
          return formatModelsText(r.data);
        }
        return formatResourcesText(r.data);
      },
    },
    factoryDeps
  );

export const resourcesCommand = createResourcesCommand();

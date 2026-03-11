import { afterEach, describe, expect, it, mock } from "bun:test";
import { RESOURCES_MESSAGES } from "../../constants";
import { createFactoryDeps } from "../../services/command-factory/test-helpers";
import type { TCommandFactoryDeps } from "../../types/command-factory";
import { createResourcesCommand } from "./command";
import type { TResourcesData } from "./types";

type TResourcesDeps = NonNullable<Parameters<typeof createResourcesCommand>[0]>;

const sampleData: TResourcesData = {
  hash: "abc123",
  resources: {
    models: [
      { model: "model-1", modality: "text", availableRunOptions: [{ key: "mode", options: ["fast", "accurate"] }] },
      { model: "model-2", modality: "image", availableRunOptions: [{ key: "mode", options: ["standard"] }] },
    ],
  },
};

const createDeps = (overrides: Partial<TResourcesDeps> = {}): TResourcesDeps => ({
  fetchResources: mock(async () => sampleData),
  loadLocalResources: mock(async () => sampleData),
  saveLocalResources: mock(async () => {}),
  ...overrides,
});

const runResources = async (
  args: string[],
  deps: TResourcesDeps,
  factoryDeps: Partial<TCommandFactoryDeps>
) => {
  const command = createResourcesCommand(deps, factoryDeps);
  await command.parseAsync(args, { from: "user" });
};

describe("resources command", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("default (no flags)", () => {
    it("reads from local cache when available", async () => {
      const deps = createDeps();
      const factory = createFactoryDeps();

      await runResources([], deps, factory);

      expect(deps.loadLocalResources).toHaveBeenCalledTimes(1);
      expect(deps.fetchResources).not.toHaveBeenCalled();
      expect(deps.saveLocalResources).not.toHaveBeenCalled();
      expect(factory.printResult).toHaveBeenCalledTimes(1);
      expect(factory.error).not.toHaveBeenCalled();
      expect(factory.setExitCode).not.toHaveBeenCalled();
    });

    it("fetches and saves when no local cache exists", async () => {
      const deps = createDeps({
        loadLocalResources: mock(async () => null),
      });
      const factory = createFactoryDeps();

      await runResources([], deps, factory);

      expect(deps.loadLocalResources).toHaveBeenCalledTimes(1);
      expect(deps.fetchResources).toHaveBeenCalledTimes(1);
      expect(deps.fetchResources).toHaveBeenCalledWith({ skipModelsHash: true });
      expect(deps.saveLocalResources).toHaveBeenCalledTimes(1);
      expect(deps.saveLocalResources).toHaveBeenCalledWith(sampleData);
      expect(factory.printResult).toHaveBeenCalledTimes(1);
      expect(factory.error).not.toHaveBeenCalled();
    });
  });

  describe("--remote flag", () => {
    it("always fetches fresh, does not save locally", async () => {
      const deps = createDeps();
      const factory = createFactoryDeps();

      await runResources(["--remote"], deps, factory);

      expect(deps.fetchResources).toHaveBeenCalledTimes(1);
      expect(deps.fetchResources).toHaveBeenCalledWith({ skipModelsHash: true });
      expect(deps.loadLocalResources).not.toHaveBeenCalled();
      expect(deps.saveLocalResources).not.toHaveBeenCalled();
      expect(factory.printResult).toHaveBeenCalledTimes(1);
      expect(factory.error).not.toHaveBeenCalled();
    });
  });

  describe("--sync flag", () => {
    it("fetches from API and saves to local cache", async () => {
      const deps = createDeps();
      const factory = createFactoryDeps();

      await runResources(["--sync"], deps, factory);

      expect(deps.fetchResources).toHaveBeenCalledTimes(1);
      expect(deps.fetchResources).toHaveBeenCalledWith({ skipModelsHash: true });
      expect(deps.loadLocalResources).not.toHaveBeenCalled();
      expect(deps.saveLocalResources).toHaveBeenCalledTimes(1);
      expect(deps.saveLocalResources).toHaveBeenCalledWith(sampleData);
      expect(factory.printResult).toHaveBeenCalledTimes(1);
      expect(factory.error).not.toHaveBeenCalled();
    });
  });

  describe("--remote --sync flags together", () => {
    it("errors with mutually exclusive message and sets exit code 1", async () => {
      const deps = createDeps();
      const factory = createFactoryDeps();

      await runResources(["--remote", "--sync"], deps, factory);

      expect(deps.fetchResources).not.toHaveBeenCalled();
      expect(deps.saveLocalResources).not.toHaveBeenCalled();
      expect(factory.printResult).not.toHaveBeenCalled();
      expect(factory.error).toHaveBeenCalledTimes(1);
      expect(factory.error).toHaveBeenCalledWith(
        expect.stringContaining("--remote and --sync are mutually exclusive.")
      );
      expect(factory.setExitCode).toHaveBeenCalledWith(1);
    });
  });

  describe("--models-only flag", () => {
    it("outputs only the models array, does not affect fetching", async () => {
      const deps = createDeps();
      const factory = createFactoryDeps();

      await runResources(["--models-only"], deps, factory);

      expect(deps.loadLocalResources).toHaveBeenCalledTimes(1);
      expect(factory.printResult).toHaveBeenCalledTimes(1);

      const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock
        .calls[0] as [unknown, { outputFormat: string }];
      expect(ctx.outputFormat).toBe("text");
      expect(data as string).toContain("model-1");
      expect(data as string).toContain("model-2");
      // formatResourcesText includes a section header; formatModelsText does not
      expect(data as string).not.toMatch(/^models\n/);
    });

    it("outputs only models array in json mode", async () => {
      const deps = createDeps();
      const factory = createFactoryDeps();

      await runResources(["--models-only", "--json"], deps, factory);

      const [data] = (factory.printResult as ReturnType<typeof mock>).mock
        .calls[0] as [unknown];
      expect(data).toEqual({ kind: "models", data: sampleData.resources.models });
    });
  });

  describe("--json flag", () => {
    it("outputs full TResourcesData as JSON when --json is set", async () => {
      const deps = createDeps();
      const factory = createFactoryDeps();

      await runResources(["--json"], deps, factory);

      expect(factory.printResult).toHaveBeenCalledTimes(1);
      const [data, ctx] = (factory.printResult as ReturnType<typeof mock>).mock
        .calls[0] as [unknown, { outputFormat: string }];
      expect(data).toEqual({ kind: "full", data: sampleData });
      expect(ctx.outputFormat).toBe("json");
      expect(factory.error).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("logs error and sets exit code 1 on fetch failure", async () => {
      const deps = createDeps({
        loadLocalResources: mock(async () => null),
        fetchResources: mock(async () => {
          throw new Error("GET /resources failed (500)");
        }),
      });
      const factory = createFactoryDeps();

      await runResources([], deps, factory);

      expect(factory.printResult).not.toHaveBeenCalled();
      expect(factory.error).toHaveBeenCalledTimes(1);
      expect(factory.error).toHaveBeenCalledWith(
        expect.stringContaining("GET /resources failed (500)")
      );
      expect(factory.setExitCode).toHaveBeenCalledWith(1);
    });

    it("logs error with failedPrefix", async () => {
      const deps = createDeps({
        loadLocalResources: mock(async () => null),
        fetchResources: mock(async () => {
          throw new Error("some error");
        }),
      });
      const factory = createFactoryDeps();

      await runResources([], deps, factory);

      expect(factory.error).toHaveBeenCalledWith(
        expect.stringContaining(RESOURCES_MESSAGES.failedPrefix)
      );
    });

    it("handles non-Error throwables and sets exit code 1", async () => {
      const deps = createDeps({
        loadLocalResources: mock(async () => null),
        fetchResources: mock(async () => {
          throw "resources timeout";
        }),
      });
      const factory = createFactoryDeps();

      await runResources([], deps, factory);

      expect(factory.error).toHaveBeenCalledWith(
        expect.stringContaining("resources timeout")
      );
      expect(factory.setExitCode).toHaveBeenCalledWith(1);
    });
  });
});

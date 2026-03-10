import { afterEach, describe, expect, it, mock } from "bun:test";
import { RESOURCES_MESSAGES } from "../../constants";
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
  printResult: mock(() => {}),
  error: mock(() => {}),
  setExitCode: mock(() => {}),
  ...overrides,
});

const runResources = async (args: string[], deps: TResourcesDeps) => {
  const command = createResourcesCommand(deps);
  await command.parseAsync(args, { from: "user" });
};

describe("resources command", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("default (no flags)", () => {
    it("reads from local cache when available", async () => {
      const deps = createDeps();

      await runResources([], deps);

      expect(deps.loadLocalResources).toHaveBeenCalledTimes(1);
      expect(deps.fetchResources).not.toHaveBeenCalled();
      expect(deps.saveLocalResources).not.toHaveBeenCalled();
      expect(deps.printResult).toHaveBeenCalledTimes(1);
      expect(deps.error).not.toHaveBeenCalled();
      expect(deps.setExitCode).not.toHaveBeenCalled();
    });

    it("fetches and saves when no local cache exists", async () => {
      const deps = createDeps({
        loadLocalResources: mock(async () => null),
      });

      await runResources([], deps);

      expect(deps.loadLocalResources).toHaveBeenCalledTimes(1);
      expect(deps.fetchResources).toHaveBeenCalledTimes(1);
      expect(deps.fetchResources).toHaveBeenCalledWith({ skipModelsHash: true });
      expect(deps.saveLocalResources).toHaveBeenCalledTimes(1);
      expect(deps.saveLocalResources).toHaveBeenCalledWith(sampleData);
      expect(deps.printResult).toHaveBeenCalledTimes(1);
      expect(deps.error).not.toHaveBeenCalled();
    });
  });

  describe("--remote flag", () => {
    it("always fetches fresh, does not save locally", async () => {
      const deps = createDeps();

      await runResources(["--remote"], deps);

      expect(deps.fetchResources).toHaveBeenCalledTimes(1);
      expect(deps.fetchResources).toHaveBeenCalledWith({ skipModelsHash: true });
      expect(deps.loadLocalResources).not.toHaveBeenCalled();
      expect(deps.saveLocalResources).not.toHaveBeenCalled();
      expect(deps.printResult).toHaveBeenCalledTimes(1);
      expect(deps.error).not.toHaveBeenCalled();
    });
  });

  describe("--sync flag", () => {
    it("fetches from API and saves to local cache", async () => {
      const deps = createDeps();

      await runResources(["--sync"], deps);

      expect(deps.fetchResources).toHaveBeenCalledTimes(1);
      expect(deps.fetchResources).toHaveBeenCalledWith({ skipModelsHash: true });
      expect(deps.loadLocalResources).not.toHaveBeenCalled();
      expect(deps.saveLocalResources).toHaveBeenCalledTimes(1);
      expect(deps.saveLocalResources).toHaveBeenCalledWith(sampleData);
      expect(deps.printResult).toHaveBeenCalledTimes(1);
      expect(deps.error).not.toHaveBeenCalled();
    });
  });

  describe("--remote --sync flags together", () => {
    it("errors with mutually exclusive message and sets exit code 1", async () => {
      const deps = createDeps();

      await runResources(["--remote", "--sync"], deps);

      expect(deps.fetchResources).not.toHaveBeenCalled();
      expect(deps.saveLocalResources).not.toHaveBeenCalled();
      expect(deps.printResult).not.toHaveBeenCalled();
      expect(deps.error).toHaveBeenCalledTimes(1);
      expect(deps.error).toHaveBeenCalledWith(
        expect.stringContaining("--remote and --sync are mutually exclusive.")
      );
      expect(deps.setExitCode).toHaveBeenCalledWith(1);
    });
  });

  describe("--models-only flag", () => {
    it("outputs only the models array, does not affect fetching", async () => {
      const deps = createDeps();

      await runResources(["--models-only"], deps);

      expect(deps.loadLocalResources).toHaveBeenCalledTimes(1);
      expect(deps.printResult).toHaveBeenCalledTimes(1);

      const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock
        .calls[0] as [unknown, { outputFormat: string }];
      expect(ctx.outputFormat).toBe("text");
      expect(data as string).toContain("model-1");
      expect(data as string).toContain("model-2");
      // formatResourcesText includes a section header; formatModelsText does not
      expect(data as string).not.toMatch(/^models\n/);
    });

    it("outputs only models array in json mode", async () => {
      const deps = createDeps();

      await runResources(["--models-only", "--json"], deps);

      const [data] = (deps.printResult as ReturnType<typeof mock>).mock
        .calls[0] as [unknown];
      expect(data).toEqual(sampleData.resources.models);
    });
  });

  describe("--json flag", () => {
    it("outputs full TResourcesData as JSON when --json is set", async () => {
      const deps = createDeps();

      await runResources(["--json"], deps);

      expect(deps.printResult).toHaveBeenCalledTimes(1);
      const [data, ctx] = (deps.printResult as ReturnType<typeof mock>).mock
        .calls[0] as [unknown, { outputFormat: string }];
      expect(data).toEqual(sampleData);
      expect(ctx.outputFormat).toBe("json");
      expect(deps.error).not.toHaveBeenCalled();
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

      await runResources([], deps);

      expect(deps.printResult).not.toHaveBeenCalled();
      expect(deps.error).toHaveBeenCalledTimes(1);
      expect(deps.error).toHaveBeenCalledWith(
        expect.stringContaining("GET /resources failed (500)")
      );
      expect(deps.setExitCode).toHaveBeenCalledWith(1);
    });

    it("logs error with failedPrefix", async () => {
      const deps = createDeps({
        loadLocalResources: mock(async () => null),
        fetchResources: mock(async () => {
          throw new Error("some error");
        }),
      });

      await runResources([], deps);

      expect(deps.error).toHaveBeenCalledWith(
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

      await runResources([], deps);

      expect(deps.error).toHaveBeenCalledWith(
        expect.stringContaining("resources timeout")
      );
      expect(deps.setExitCode).toHaveBeenCalledWith(1);
    });
  });
});

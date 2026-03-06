import { describe, expect, it, mock } from "bun:test";
import { runReset } from "./service";

describe("services/reset/service runReset", () => {
  it("throws when force is not enabled", async () => {
    await expect(runReset()).rejects.toThrow("Reset confirmation required");
  });

  it("removes directory and returns confirmation when force is true", async () => {
    const removeDirectory = mock(async () => {});

    const result = await runReset({
      force: true,
      deps: {
        removeDirectory,
      },
    });

    expect(removeDirectory).toHaveBeenCalledTimes(1);
    expect(result.confirmed).toBe(true);
    expect(result.removedPath).toContain(".betterprompt");
  });

  it("propagates dependency errors", async () => {
    const removeDirectory = mock(async () => {
      throw new Error("disk is read-only");
    });

    await expect(
      runReset({
        force: true,
        deps: {
          removeDirectory,
        },
      })
    ).rejects.toThrow("disk is read-only");
  });
});

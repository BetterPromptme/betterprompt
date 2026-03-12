import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "bun:test";

const COMMANDS_DIR = path.resolve(import.meta.dir);

const getTopLevelCommandDirs = (): string[] => {
  return readdirSync(COMMANDS_DIR).filter((entry) => {
    const fullPath = path.join(COMMANDS_DIR, entry);
    return statSync(fullPath).isDirectory();
  });
};

const toPascalCase = (kebab: string): string =>
  kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

describe("command export convention", () => {
  const commandDirs = getTopLevelCommandDirs();

  it("has at least one command directory", () => {
    expect(commandDirs.length).toBeGreaterThan(0);
  });

  for (const dir of commandDirs) {
    const commandFilePath = path.join(COMMANDS_DIR, dir, "command.ts");

    it(`${dir}/command.ts exports createXxxCommand and xxxCommand`, async () => {
      let exports: Record<string, unknown>;
      try {
        exports = await import(commandFilePath);
      } catch {
        throw new Error(
          `Could not import ${commandFilePath}. Does the directory contain a command.ts?`
        );
      }
      const pascal = toPascalCase(dir);

      const factoryName = `create${pascal}Command`;
      const instanceName = `${dir.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}Command`;

      expect(exports).toHaveProperty(factoryName);
      expect(typeof exports[factoryName]).toBe("function");

      expect(exports).toHaveProperty(instanceName);
    });
  }
});

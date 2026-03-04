import { execFileSync } from "node:child_process";

export const isCommandAvailable = (command: string): boolean => {
  const lookup = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(lookup, [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

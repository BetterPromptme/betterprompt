import { execFile as nodeExecFile } from "node:child_process";

import type { TOpenBrowserDeps } from "../../types/login";

const defaultDeps: TOpenBrowserDeps = {
  platform: process.platform,
  execFile: nodeExecFile as TOpenBrowserDeps["execFile"],
};

export const openBrowser = (
  url: string,
  deps: TOpenBrowserDeps = defaultDeps
): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    try {
      let cmd: string;
      let args: string[];

      if (deps.platform === "darwin") {
        cmd = "open";
        args = [url];
      } else if (deps.platform === "linux") {
        cmd = "xdg-open";
        args = [url];
      } else if (deps.platform === "win32") {
        cmd = "cmd";
        args = ["/c", "start", url];
      } else {
        resolve(false);
        return;
      }

      deps.execFile(cmd, args, (error) => {
        resolve(!error);
      });
    } catch {
      resolve(false);
    }
  });
};

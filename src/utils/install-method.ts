import path from "node:path";

import { UPDATE_BINARY } from "../constants/update";
import type { TInstallMethodInfo } from "../types/update";

type TDetectInstallMethodDeps = {
  getExecPath: () => string;
};

const defaultDeps: TDetectInstallMethodDeps = {
  getExecPath: () => process.execPath,
};

export const detectInstallMethod = (
  deps: TDetectInstallMethodDeps = defaultDeps
): TInstallMethodInfo => {
  const execPath = deps.getExecPath();
  const basename = path.basename(execPath);
  const method = basename.startsWith(UPDATE_BINARY.binaryName)
    ? "binary"
    : "package-manager";

  return {
    method,
    execPath,
    installDir: path.dirname(execPath),
  };
};

import { UPDATE_MESSAGES } from "../constants/update";
import type { TPlatformInfo } from "../types/update";

const SUPPORTED_PLATFORMS = new Set(["darwin", "linux"]);
const SUPPORTED_ARCHS = new Set(["x64", "arm64"]);

type TResolvePlatformDeps = {
  getPlatform: () => string;
  getArch: () => string;
};

const defaultDeps: TResolvePlatformDeps = {
  getPlatform: () => process.platform,
  getArch: () => process.arch,
};

export const resolvePlatform = (
  deps: TResolvePlatformDeps = defaultDeps
): TPlatformInfo => {
  const os = deps.getPlatform();
  const arch = deps.getArch();

  if (!SUPPORTED_PLATFORMS.has(os)) {
    throw new Error(UPDATE_MESSAGES.unsupportedPlatform);
  }

  if (!SUPPORTED_ARCHS.has(arch)) {
    throw new Error(UPDATE_MESSAGES.unsupportedArch);
  }

  return { os, arch };
};

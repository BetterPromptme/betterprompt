import { SHARED_FLAGS } from "./shared-flags";

export const UPDATE_COMMAND = {
  name: "update",
  description: "Check for CLI updates and install when available",
  flags: {
    json: SHARED_FLAGS.json,
  },
} as const;

export const UPDATE_BINARY = {
  repo: "BetterPromptme/betterprompt",
  binaryName: "betterprompt",
  symlinkName: "bp",
  githubApiUrl:
    "https://api.github.com/repos/BetterPromptme/betterprompt/releases/latest",
  githubDownloadBaseUrl:
    "https://github.com/BetterPromptme/betterprompt/releases/download",
} as const;

export const UPDATE_MESSAGES = {
  failedPrefix: "Update command failed:",
  noPackageManager:
    "No supported package manager found. Please install bun or npm.",
  registryQueryFailed: "Failed to query registry",
  registryMissingVersion: "Registry response missing latest version",
  githubApiFailed: "Failed to query GitHub releases",
  githubMissingTag: "GitHub release missing version tag",
  downloadFailed: "Failed to download binary update",
  permissionDenied: "Permission denied. Run with sudo: sudo bp update",
  unsupportedPlatform: "Unsupported platform for binary update",
  unsupportedArch: "Unsupported architecture for binary update",
  checksumMismatch:
    "Checksum verification failed — downloaded binary may be corrupted or tampered with",
  checksumFetchFailed: "Failed to fetch checksum file",
} as const;

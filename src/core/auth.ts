import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { API_CONFIG, AUTH_MESSAGES, AUTH_STORAGE } from "../constants";
import type { TAuthConfig } from "../types/auth";
import { TReadAuthOptions, TSaveAuthOptions } from "../types";
import type { TFetchLike } from "../types/api";
import type { TApiResponse } from "../types/api";
import type { TCreditBalance } from "../types/credits";
import type { TUserIdentity } from "../types/whoami";
import { loadOrInitConfig, resolveSystemConfigPath } from "./config";

export const resolveAuthConfigPath = (
  getHomeDir: () => string = os.homedir
): string =>
  path.join(getHomeDir(), AUTH_STORAGE.configDirName, AUTH_STORAGE.fileName);

export const normalizeApiKey = (value: string): string => {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(AUTH_MESSAGES.emptyKeyError);
  }

  return normalized;
};

type TVerifyApiKeyOptions = {
  baseUrl?: string;
  fetch?: TFetchLike;
};

const parseVerifyErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      if (
        payload &&
        typeof payload === "object" &&
        typeof (payload as Record<string, unknown>).message === "string"
      ) {
        return (payload as Record<string, unknown>).message as string;
      }
      return "";
    }

    const text = await response.text();
    return text.trim();
  } catch {
    return "";
  }
};

export const verifyApiKey = async (
  apiKey: string,
  options: TVerifyApiKeyOptions = {}
): Promise<void> => {
  const normalizedApiKey = normalizeApiKey(apiKey);
  const fetchClient: TFetchLike = options.fetch ?? fetch;
  const baseUrl =
    options.baseUrl ?? (await loadOrInitConfig()).apiBaseUrl ?? API_CONFIG.baseUrl;
  const requestUrl = new URL(
    "me",
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  ).toString();

  const response = await fetchClient(requestUrl, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${normalizedApiKey}`,
    },
  });

  if (!response.ok) {
    const message = await parseVerifyErrorMessage(response);
    throw new Error(
      message
        ? `${AUTH_MESSAGES.apiKeyVerifyFailedError} ${message}`
        : AUTH_MESSAGES.apiKeyVerifyFailedError
    );
  }
};

export const saveAuthConfig = async (
  apiKey: string,
  options: TSaveAuthOptions = {}
): Promise<string> => {
  const configPath = options.configPath ?? resolveAuthConfigPath();
  const normalizedApiKey = normalizeApiKey(apiKey);
  const configDir = path.dirname(configPath);
  const updatedAt = (options.now ?? new Date()).toISOString();
  const nextConfig: TAuthConfig = {
    apiKey: normalizedApiKey,
    updatedAt,
  };
  const serialized = `${JSON.stringify(nextConfig, null, 2)}\n`;
  const tempPath = `${configPath}.${AUTH_STORAGE.tempFilePrefix}-${process.pid}-${Date.now()}`;

  await mkdir(configDir, {
    recursive: true,
    mode: AUTH_STORAGE.directoryMode,
  });

  try {
    await writeFile(tempPath, serialized, { mode: AUTH_STORAGE.fileMode });
    await rename(tempPath, configPath);
    await chmod(configPath, AUTH_STORAGE.fileMode).catch(() => {});
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }

  return configPath;
};

const extractApiKeyFromParsed = (
  parsed: Record<string, unknown>
): string | undefined => {
  // New flat format: { apiKey, updatedAt }
  const flat = parsed.apiKey;
  if (typeof flat === "string" && flat.trim()) {
    return flat;
  }

  // Legacy nested format: { auth: { apiKey } }
  const auth = parsed.auth;
  if (typeof auth === "object" && auth !== null && !Array.isArray(auth)) {
    const nested = (auth as Record<string, unknown>).apiKey;
    if (typeof nested === "string" && nested.trim()) {
      return nested;
    }
  }

  return undefined;
};

export const readApiKeyFromAuthConfig = async (
  options: TReadAuthOptions = {}
): Promise<string> => {
  const configPath = options.configPath ?? resolveAuthConfigPath();

  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      const fallbackPath = resolveSystemConfigPath(() =>
        path.dirname(path.dirname(configPath))
      );
      if (fallbackPath !== configPath) {
        return readApiKeyFromAuthConfig({ configPath: fallbackPath });
      }
      throw new Error(AUTH_MESSAGES.apiKeyNotFoundError);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(AUTH_MESSAGES.configMustBeObjectError);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(AUTH_MESSAGES.configMustBeObjectError);
  }

  const apiKey = extractApiKeyFromParsed(parsed as Record<string, unknown>);
  if (!apiKey) {
    throw new Error(AUTH_MESSAGES.apiKeyNotFoundError);
  }

  return normalizeApiKey(apiKey);
};

type TCurrentUserApi = {
  get: (path: string) => Promise<TApiResponse<TUserIdentity>>;
};

type TCreditsApi = {
  get: (path: string) => Promise<TApiResponse<TCreditBalance>>;
};

export const getCurrentUser = async (
  apiClient: TCurrentUserApi
): Promise<TUserIdentity> => {
  const response = await apiClient.get("/me");

  if (response.status === "SUCCESS" && response.data) {
    return response.data;
  }

  throw new Error(response.message ?? "Failed to fetch current user.");
};

export const getCredits = async (
  apiClient: TCreditsApi
): Promise<TCreditBalance> => {
  const response = await apiClient.get("/me/credits");

  if (response.status === "SUCCESS" && response.data) {
    return response.data;
  }

  throw new Error(response.message ?? "Failed to fetch credits.");
};

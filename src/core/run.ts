import { RUN_MESSAGES } from "../constants";
import type { ApiClient } from "./api";
import type {
  TRunInputs,
  TRunOptions,
  TRunPayload,
  TRunResponse,
} from "../types/run";

export const validateRunPayload = (payload: TRunPayload): void => {
  if (!payload.promptVersionId.trim()) {
    throw new Error(RUN_MESSAGES.invalidPromptVersionId);
  }

  if (payload.inputs === undefined) {
    throw new Error(RUN_MESSAGES.inputsRequired);
  }
};

export const parseInputsJson = (raw: string): TRunInputs => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(RUN_MESSAGES.invalidInputsJson);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(RUN_MESSAGES.invalidInputsJson);
  }

  const obj = parsed as Record<string, unknown>;
  const result: TRunInputs = {};

  if (obj.textInputs !== undefined) {
    result.textInputs = obj.textInputs as Record<string, string>;
  }

  if (obj.imageInputs !== undefined) {
    result.imageInputs = obj.imageInputs as TRunInputs["imageInputs"];
  }

  return result;
};

export const parseRunOptionsJson = (
  raw: string | undefined
): TRunOptions | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(RUN_MESSAGES.invalidRunOptionsJson);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(RUN_MESSAGES.invalidRunOptionsJson);
  }

  return parsed as TRunOptions;
};

type TRunApiClient = Pick<ApiClient, "post">;

export const createRun = async (
  apiClient: TRunApiClient,
  payload: TRunPayload
): Promise<TRunResponse> => {
  return apiClient.post<TRunResponse>("/runs", payload);
};

type TGetRunApiClient = Pick<ApiClient, "get">;

export const validateRunId = (runId: string): void => {
  if (!runId.trim()) {
    throw new Error(RUN_MESSAGES.invalidRunId);
  }
};

export const getRun = async (
  apiClient: TGetRunApiClient,
  runId: string,
  opts: { remote?: boolean } = {}
): Promise<TRunResponse> => {
  return apiClient.get<TRunResponse>(`/runs/${runId}`, {
    query: opts.remote === true ? { remote: true } : undefined,
  });
};

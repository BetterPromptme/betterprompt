import type { RunStatus } from "../enums/run-status";
import type { TApiResponse } from "./api";
import { TPart } from "./output";

export type TImageInputUrl = {
  type: "url";
  url: string;
};

export type TImageInputBase64 = {
  type: "base64";
  base64: string;
};

export type TImageInput = TImageInputUrl | TImageInputBase64;

export type TRunInputs = {
  textInputs?: Record<string, string>;
  imageInputs?: TImageInput[];
};

export type TRunOptions = {
  reasoningEffort?: string;
  seconds?: string;
  size?: string;
  aspectRatio?: string;
  quality?: string;
};

export type TRunPayload = {
  promptVersionId: string;
  inputs?: TRunInputs;
  runModel?: string;
  runOptions?: TRunOptions;
};

export type TRunResult = {
  runId: string;
  outputs: TPart[];
  runStatus: RunStatus;
  createdAt: string;
  promptVersionId: string;
};

export type TRunResponse = TApiResponse<TRunResult>;

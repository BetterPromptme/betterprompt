import type { TGenerateRunResult } from "../../commands/generate/types";
import { PartType } from "../../enums";
import type { TPart } from "../../types/outputs";

export const isRunResult = (value: unknown): value is TGenerateRunResult => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TGenerateRunResult>;
  return (
    typeof candidate.runId === "string" &&
    Array.isArray(candidate.outputs) &&
    typeof candidate.runStatus === "string"
  );
};

export const formatPartForTextOutput = (part: TPart): string => {
  switch (part.type) {
    case PartType.TEXT:
    case PartType.IMAGE:
    case PartType.ERROR:
    case PartType.VIDEO:
      return part.data;
    default:
      return "";
  }
};

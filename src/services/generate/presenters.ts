import { PART_TYPE } from "../../enums";
import type { TPart } from "../../types/output";
import type { TGenerateRunResult } from "../../commands/generate/types";

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
    case PART_TYPE.TEXT:
    case PART_TYPE.IMAGE:
    case PART_TYPE.ERROR:
    case PART_TYPE.VIDEO:
      return part.data;
    default:
      return "";
  }
};

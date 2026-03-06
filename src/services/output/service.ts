import type { TPrintOptions } from "../../types/output";

const serializeJson = (data: unknown): string => {
  const serialized = JSON.stringify(data);
  return serialized ?? "null";
};

export const formatResult = (data: unknown, ctx: TPrintOptions): string => {
  if (ctx.outputFormat === "json") {
    return serializeJson(data);
  }

  if (typeof data === "string") {
    return data;
  }

  if (data === null || data === undefined) {
    return "null";
  }

  return JSON.stringify(data, null, 2);
};

export const printResult = (data: unknown, ctx: TPrintOptions): void => {
  console.log(formatResult(data, ctx));
};

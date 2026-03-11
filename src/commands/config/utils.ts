import { InvalidArgumentError } from "commander";
import { CONFIG_MESSAGES } from "../../constants";
import type { TSystemConfigKey } from "./types";

export const maskApiKey = (value: string): string => {
  if (value.length <= 4) return "****";
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
};

export const parseConfigKey = (value: string): TSystemConfigKey => {
  if (value === "apiKey" || value === "apiBaseUrl") {
    return value;
  }

  throw new InvalidArgumentError(CONFIG_MESSAGES.invalidKeyError(value));
};

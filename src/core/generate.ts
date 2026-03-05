import type {
  TInputValues,
  TJsonSchema,
  TResolveInputsOptions,
  TResolvedInputsResult,
  TValidationDetail,
} from "../types/generate";

type TValidationError = Error & {
  details: TValidationDetail[];
};

const INPUT_VALIDATION_FAILED_MESSAGE = "Input validation failed.";

const parseInputPairs = (input: string[] = []): TInputValues =>
  input.reduce<TInputValues>((acc, pair) => {
    const separatorIndex = pair.indexOf("=");

    if (separatorIndex < 0) {
      acc[pair.trim()] = "";
      return acc;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1);

    acc[key] = value;
    return acc;
  }, {});

const parseStdinJson = (stdinJson?: string): TInputValues => {
  if (stdinJson === undefined || stdinJson.trim() === "") {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdinJson);
  } catch {
    throw new Error("Invalid JSON provided via --stdin.");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Stdin JSON must be an object.");
  }

  return Object.entries(parsed).reduce<TInputValues>((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key] = value;
      return acc;
    }

    acc[key] = String(value);
    return acc;
  }, {});
};

const getMissingRequiredFields = (
  schema: TJsonSchema | undefined,
  resolvedInputs: TInputValues
): string[] => {
  if (schema?.required === undefined) {
    return [];
  }

  return schema.required.filter((field) => resolvedInputs[field] === undefined);
};

const createInputValidationError = (
  details: TValidationDetail[]
): TValidationError => {
  const error = new Error(INPUT_VALIDATION_FAILED_MESSAGE) as TValidationError;
  error.details = details;
  return error;
};

const validateAgainstSchema = (
  schema: TJsonSchema | undefined,
  resolvedInputs: TInputValues
): void => {
  if (schema === undefined) {
    return;
  }

  const details: TValidationDetail[] = [];
  const requiredFields = schema.required ?? [];

  requiredFields.forEach((field) => {
    if (resolvedInputs[field] === undefined) {
      details.push({
        field,
        message: `Missing required field: ${field}`,
      });
    }
  });

  const properties = schema.properties ?? {};

  Object.entries(properties).forEach(([field, rule]) => {
    const value = resolvedInputs[field];
    if (value === undefined) {
      return;
    }

    if (rule.type === "string" && typeof value !== "string") {
      details.push({
        field,
        message: `Field ${field} must be a string.`,
      });
    }

    if (
      rule.minLength !== undefined &&
      typeof value === "string" &&
      value.length < rule.minLength
    ) {
      details.push({
        field,
        message: `Field ${field} must be at least ${rule.minLength} characters long.`,
      });
    }
  });

  if (details.length > 0) {
    throw createInputValidationError(details);
  }
};

export const resolveInputs = async (
  options: TResolveInputsOptions
): Promise<TResolvedInputsResult> => {
  const defaults = options.defaults ?? {};
  const stdinInputs = parseStdinJson(options.stdinJson);
  const cliInputs = parseInputPairs(options.input);

  const resolvedInputs: TInputValues = {
    ...defaults,
    ...stdinInputs,
    ...cliInputs,
  };

  const missingRequiredFields = getMissingRequiredFields(
    options.schema,
    resolvedInputs
  );

  if (
    options.interactive === true &&
    missingRequiredFields.length > 0 &&
    options.promptForMissing !== undefined
  ) {
    const promptedInputs = await options.promptForMissing(missingRequiredFields);
    Object.assign(resolvedInputs, promptedInputs);
  }

  validateAgainstSchema(options.schema, resolvedInputs);

  return { inputs: resolvedInputs };
};

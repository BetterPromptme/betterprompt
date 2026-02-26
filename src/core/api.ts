import { API_CONFIG, AUTH_MESSAGES } from "../constants";
import type {
  TApiClientConfig,
  TApiRequestOptions,
  TFetchLike,
  TTokenProvider,
} from "../types/api";
import { readApiKeyFromAuthConfig } from "./auth";
import { getLoadedSystemConfig } from "./config";

export type {
  TApiClientConfig,
  TApiRequestOptions,
  TFetchLike,
  TTokenProvider,
} from "../types/api";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly method: string;
  readonly requestUrl: string;

  constructor(params: {
    message: string;
    status: number;
    code?: string;
    details?: unknown;
    method: string;
    requestUrl: string;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.method = params.method;
    this.requestUrl = params.requestUrl;
  }
}

type TResolvedConfig = {
  baseUrl: string;
  timeoutMs: number;
  headers: Headers;
  authHeader: string;
  authScheme: string;
  getApiKey?: TTokenProvider;
  fetch: TFetchLike;
};

const isBodyInit = (value: unknown): value is BodyInit =>
  typeof value === "string" ||
  value instanceof Blob ||
  value instanceof ArrayBuffer ||
  value instanceof URLSearchParams ||
  value instanceof FormData ||
  value instanceof ReadableStream;

const mergeHeaders = (
  ...headersList: Array<HeadersInit | undefined>
): Headers => {
  const merged = new Headers();

  headersList.forEach((headers) => {
    if (!headers) {
      return;
    }

    new Headers(headers).forEach((value, key) => {
      merged.set(key, value);
    });
  });

  return merged;
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length ? text : undefined;
};

const resolveErrorMessage = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === "object") {
    const candidate = payload as Record<string, unknown>;
    const message = candidate.message ?? candidate.error;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
};

const formatAuthorizationValue = (token: string, scheme: string): string => {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return trimmedToken;
  }

  const normalizedScheme = scheme.trim();
  if (!normalizedScheme) {
    return trimmedToken;
  }

  const [firstSegment] = trimmedToken.split(/\s+/, 1);
  if (firstSegment.toLowerCase() === normalizedScheme.toLowerCase()) {
    return trimmedToken;
  }

  return `${normalizedScheme} ${trimmedToken}`;
};

const resolveRuntimeBaseUrl = (): string =>
  getLoadedSystemConfig()?.apiBaseUrl ?? API_CONFIG.baseUrl;

export class ApiClient {
  private config: TResolvedConfig;

  constructor(config: TApiClientConfig = {}) {
    this.config = this.resolveConfig(config);
  }

  configure(config: TApiClientConfig): void {
    this.config = this.resolveConfig(config, this.config);
  }

  async request<TResponse = unknown>(
    path: string,
    options: TApiRequestOptions = {}
  ): Promise<TResponse> {
    const method = (options.method ?? "GET").toUpperCase();
    const requestUrl = this.buildUrl(path, options.query);
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const headers = mergeHeaders(this.config.headers, options.headers);

    if (!headers.has(this.config.authHeader)) {
      const apiKey = await this.config.getApiKey?.();
      if (!apiKey?.trim()) {
        throw new Error(AUTH_MESSAGES.apiKeyNotFoundError);
      }
      headers.set(
        this.config.authHeader,
        formatAuthorizationValue(apiKey, this.config.authScheme)
      );
    }

    const controller = new AbortController();
    const onAbort = () => controller.abort();

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const body = this.serializeBody(options.body, headers, method);

    try {
      const response = await this.config.fetch(requestUrl, {
        ...options,
        method,
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await parseResponseBody(response);

        throw new ApiError({
          message: resolveErrorMessage(
            payload,
            `${method} ${requestUrl} failed (${response.status})`
          ),
          status: response.status,
          code:
            payload && typeof payload === "object"
              ? ((payload as Record<string, unknown>).code as
                  | string
                  | undefined)
              : undefined,
          details: payload,
          method,
          requestUrl,
        });
      }

      if (options.parseAs === "response") {
        return response as TResponse;
      }

      if (options.parseAs === "void") {
        return undefined as TResponse;
      }

      if (options.parseAs === "text") {
        return (await response.text()) as TResponse;
      }

      if (response.status === 204) {
        return undefined as TResponse;
      }

      return (await response.json()) as TResponse;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      const maybeError = error as Error;
      const isTimeoutAbort =
        controller.signal.aborted && maybeError.name === "AbortError";
      const message = isTimeoutAbort
        ? `Request timed out after ${timeoutMs}ms`
        : maybeError.message || "Network request failed";

      throw new ApiError({
        message,
        status: 0,
        method,
        requestUrl,
      });
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }

  get<TResponse = unknown>(
    path: string,
    options: Omit<TApiRequestOptions, "method" | "body"> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>(path, { ...options, method: "GET" });
  }

  post<TResponse = unknown>(
    path: string,
    body?: unknown,
    options: Omit<TApiRequestOptions, "method" | "body"> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>(path, { ...options, method: "POST", body });
  }

  put<TResponse = unknown>(
    path: string,
    body?: unknown,
    options: Omit<TApiRequestOptions, "method" | "body"> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>(path, { ...options, method: "PUT", body });
  }

  patch<TResponse = unknown>(
    path: string,
    body?: unknown,
    options: Omit<TApiRequestOptions, "method" | "body"> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>(path, { ...options, method: "PATCH", body });
  }

  delete<TResponse = unknown>(
    path: string,
    options: Omit<TApiRequestOptions, "method" | "body"> = {}
  ): Promise<TResponse> {
    return this.request<TResponse>(path, { ...options, method: "DELETE" });
  }

  private resolveConfig(
    config: TApiClientConfig,
    previous?: TResolvedConfig
  ): TResolvedConfig {
    return {
      baseUrl: config.baseUrl ?? previous?.baseUrl ?? resolveRuntimeBaseUrl(),
      timeoutMs:
        config.timeoutMs ?? previous?.timeoutMs ?? API_CONFIG.timeoutMs,
      headers: mergeHeaders(
        API_CONFIG.defaultHeaders,
        previous?.headers,
        config.headers
      ),
      authHeader:
        config.authHeader ?? previous?.authHeader ?? API_CONFIG.authHeader,
      authScheme:
        config.authScheme ?? previous?.authScheme ?? API_CONFIG.authScheme,
      getApiKey:
        config.getApiKey ?? previous?.getApiKey ?? readApiKeyFromAuthConfig,
      fetch: config.fetch ?? previous?.fetch ?? fetch,
    };
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | null | undefined>
  ): string {
    const trimmedPath = path.trim();
    const isAbsoluteUrl = /^https?:\/\//i.test(trimmedPath);
    const normalizedBaseUrl = this.config.baseUrl.replace(/\/+$/, "");
    const normalizedPath = trimmedPath.replace(/^\/+/, "");
    const url = isAbsoluteUrl
      ? new URL(trimmedPath)
      : new URL(
          normalizedPath
            ? `${normalizedBaseUrl}/${normalizedPath}`
            : `${normalizedBaseUrl}/`
        );

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return;
        }
        url.searchParams.set(key, String(value));
      });
    }

    return url.toString();
  }

  private serializeBody(
    body: unknown,
    headers: Headers,
    method: string
  ): BodyInit | undefined {
    if (body === undefined || method === "GET" || method === "HEAD") {
      return undefined;
    }

    if (isBodyInit(body)) {
      return body;
    }

    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return JSON.stringify(body);
  }
}

let apiClientInstance: ApiClient | undefined;

export const getApiClient = (config: TApiClientConfig = {}): ApiClient => {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient(config);
    return apiClientInstance;
  }

  if (Object.keys(config).length > 0) {
    apiClientInstance.configure(config);
  }

  return apiClientInstance;
};

export const resetApiClientForTests = (): void => {
  apiClientInstance = undefined;
};

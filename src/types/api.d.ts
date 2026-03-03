export type TFetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type TTokenProvider = () =>
  | string
  | undefined
  | Promise<string | undefined>;

export type TApiClientConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  headers?: HeadersInit;
  authHeader?: string;
  authScheme?: string;
  getApiKey?: TTokenProvider;
  fetch?: TFetchLike;
};

export type TApiRequestOptions = Omit<
  RequestInit,
  "body" | "headers" | "signal"
> & {
  body?: unknown;
  headers?: HeadersInit;
  parseAs?: "json" | "text" | "response" | "void";
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type TApiResponse<TData = unknown> = {
  data?: TData;
  status: string;
  message?: string;
};

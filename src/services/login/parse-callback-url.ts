import { LOGIN_CALLBACK, LOGIN_MESSAGES } from "../../constants";

export const parseCallbackUrl = (
  rawUrl: string,
  expectedState: string
): { apiKey: string } => {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error(LOGIN_MESSAGES.pasteInvalidUrl);
  }

  const state = url.searchParams.get(LOGIN_CALLBACK.queryParams.state);
  if (state !== expectedState) {
    throw new Error(LOGIN_MESSAGES.stateMismatch);
  }

  const apiKey = url.searchParams.get(LOGIN_CALLBACK.queryParams.apiKey);
  if (!apiKey) {
    throw new Error(LOGIN_MESSAGES.missingApiKey);
  }

  return { apiKey };
};

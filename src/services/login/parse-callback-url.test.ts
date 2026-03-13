import { describe, expect, it } from "bun:test";

import { LOGIN_MESSAGES } from "../../constants";
import { parseCallbackUrl } from "./parse-callback-url";

describe("parseCallbackUrl", () => {
  const expectedState = "abc123";
  const validUrl = `http://localhost:22450/callback?api_key=key_456&state=${expectedState}`;

  it("returns apiKey from a valid callback URL", () => {
    const result = parseCallbackUrl(validUrl, expectedState);
    expect(result).toEqual({ apiKey: "key_456" });
  });

  it("trims whitespace from the URL", () => {
    const result = parseCallbackUrl(`  ${validUrl}  \n`, expectedState);
    expect(result).toEqual({ apiKey: "key_456" });
  });

  it("throws stateMismatch when state does not match", () => {
    const url = `http://localhost:22450/callback?api_key=key_456&state=wrong`;
    expect(() => parseCallbackUrl(url, expectedState)).toThrow(
      LOGIN_MESSAGES.stateMismatch
    );
  });

  it("throws missingApiKey when api_key is absent", () => {
    const url = `http://localhost:22450/callback?state=${expectedState}`;
    expect(() => parseCallbackUrl(url, expectedState)).toThrow(
      LOGIN_MESSAGES.missingApiKey
    );
  });

  it("throws pasteInvalidUrl for unparseable input", () => {
    expect(() => parseCallbackUrl("not-a-url", expectedState)).toThrow(
      LOGIN_MESSAGES.pasteInvalidUrl
    );
  });

  it("throws missingApiKey when api_key is empty string", () => {
    const url = `http://localhost:22450/callback?api_key=&state=${expectedState}`;
    expect(() => parseCallbackUrl(url, expectedState)).toThrow(
      LOGIN_MESSAGES.missingApiKey
    );
  });
});

import { CLI_HOSTS } from "./cli";

const LOGIN_URL_BASE = `${CLI_HOSTS.web}/api-keys`;

export const LOGIN_COMMAND = {
  name: "login",
  description: "Authenticate BetterPrompt CLI via browser",
} as const;

export const LOGIN_CALLBACK = {
  loginUrlBase: LOGIN_URL_BASE,
  loginAction: "cli-login",
  callbackPath: "/callback",
  portRange: { min: 22450, max: 22460 },
  defaultTimeoutMs: 5 * 60 * 1000,
  queryParams: {
    callbackPort: "callback_port",
    state: "state",
    apiKey: "api_key",
    action: "action",
  },
  stateByteLength: 32,
} as const;

export const LOGIN_MESSAGES = {
  introTitle: "BetterPrompt Login",
  browserPrompt: "Finish signing in via your browser",
  linkInstructions:
    "If the link doesn't open automatically, open the following link to authenticate:",
  loginPromptSuffix: "Press Ctrl+C to cancel",
  waitingForCallback: "Waiting for authentication...",
  noAvailablePort:
    "No available port in range 22450–22460. Close other processes and try again.",
  callbackTimeout: "Authentication timed out. Please try again.",
  stateMismatch: "Authentication failed: state mismatch. Please try again.",
  missingApiKey:
    "Authentication failed: API key not received. Please try again.",
  verifyKeyText: "Verifying API key...",
  successPrefix: "Authentication successful. Credentials saved to",
  cancelMessage: "Login canceled.",
  failedPrefix: "Login failed:",
  failedNoChangesPrefix: "No changes were saved to",
  pastePrompt: "Paste the callback URL here: ",
  pasteInvalidUrl:
    "Invalid callback URL. Please paste the full URL from your browser.",
} as const;

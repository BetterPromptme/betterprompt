import { randomBytes as nodeRandomBytes } from "node:crypto";
import { createServer as nodeCreateServer } from "node:http";
import { createServer as nodeCreateNetServer } from "node:net";

import { LOGIN_CALLBACK, LOGIN_MESSAGES } from "../../constants";
import type {
  TCallbackServer,
  TCallbackServerDeps,
  TCallbackServerOptions,
} from "../../types/login";
import { errorHtmlTemplate } from "./error-html";
import { successHtml } from "./success-html";

export const findAvailablePort = async (): Promise<number> => {
  const { min, max } = LOGIN_CALLBACK.portRange;

  for (let port = min; port <= max; port++) {
    const available = await new Promise<boolean>((resolve) => {
      const probe = nodeCreateNetServer();
      probe.once("error", () => resolve(false));
      probe.listen(port, "127.0.0.1", () => {
        probe.close(() => resolve(true));
      });
    });
    if (available) {
      return port;
    }
  }

  throw new Error(LOGIN_MESSAGES.noAvailablePort);
};

const defaultDeps: TCallbackServerDeps = {
  createServer:
    nodeCreateServer as unknown as TCallbackServerDeps["createServer"],
  randomBytes: nodeRandomBytes as TCallbackServerDeps["randomBytes"],
  setTimeout: globalThis.setTimeout.bind(
    globalThis
  ) as unknown as TCallbackServerDeps["setTimeout"],
  clearTimeout: globalThis.clearTimeout.bind(
    globalThis
  ) as unknown as TCallbackServerDeps["clearTimeout"],
};

export const startCallbackServer = async (
  options: TCallbackServerOptions = {},
  deps: TCallbackServerDeps = defaultDeps
): Promise<TCallbackServer> => {
  const { timeoutMs = LOGIN_CALLBACK.defaultTimeoutMs } = options;
  const state = deps
    .randomBytes(LOGIN_CALLBACK.stateByteLength)
    .toString("hex");

  let resolveCallback: ((result: { apiKey: string }) => void) | null = null;
  let rejectCallback: ((error: Error) => void) | null = null;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

  const server = deps.createServer((req, res) => {
    const method = req.method ?? "GET";
    const urlStr = req.url ?? "/";
    const [pathname, queryStr] = urlStr.split("?");

    if (method !== "GET" || pathname !== LOGIN_CALLBACK.callbackPath) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const params = new URLSearchParams(queryStr ?? "");
    const receivedState = params.get(LOGIN_CALLBACK.queryParams.state);
    const apiKey = params.get(LOGIN_CALLBACK.queryParams.apiKey);

    if (receivedState !== state) {
      res.writeHead(403, { "Content-Type": "text/html" });
      res.end(
        errorHtmlTemplate.replace("{{MESSAGE}}", LOGIN_MESSAGES.stateMismatch)
      );
      return;
    }

    if (!apiKey) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(
        errorHtmlTemplate.replace("{{MESSAGE}}", LOGIN_MESSAGES.missingApiKey)
      );
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(successHtml);

    if (resolveCallback) {
      if (timeoutId !== undefined) {
        deps.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      const resolve = resolveCallback;
      resolveCallback = null;
      rejectCallback = null;
      resolve({ apiKey });
    }
  });

  const port = await findAvailablePort();

  return new Promise<TCallbackServer>((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to get server address"));
        return;
      }

      const waitForCallback = (): Promise<{ apiKey: string }> => {
        return new Promise<{ apiKey: string }>((res, rej) => {
          resolveCallback = res;
          rejectCallback = rej;

          timeoutId = deps.setTimeout(() => {
            resolveCallback = null;
            rejectCallback = null;
            timeoutId = undefined;
            rej(new Error(LOGIN_MESSAGES.callbackTimeout));
          }, timeoutMs);
        });
      };

      const shutdown = () => {
        if (timeoutId !== undefined) {
          deps.clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        if (rejectCallback) {
          const rej = rejectCallback;
          resolveCallback = null;
          rejectCallback = null;
          rej(new Error(LOGIN_MESSAGES.cancelMessage));
        }
        server.closeAllConnections();
        server.close();
      };

      resolve({ port, state, waitForCallback, shutdown });
    });
  });
};

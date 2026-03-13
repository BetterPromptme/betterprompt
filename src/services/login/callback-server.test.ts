import { createServer } from "node:http";

import { afterEach, describe, expect, it } from "bun:test";

import { LOGIN_CALLBACK, LOGIN_MESSAGES } from "../../constants";
import type { TCallbackServer } from "../../types/login";
import { findAvailablePort, startCallbackServer } from "./callback-server";

describe("findAvailablePort", () => {
  it("returns a port within the configured range", async () => {
    const port = await findAvailablePort();
    expect(port).toBeGreaterThanOrEqual(LOGIN_CALLBACK.portRange.min);
    expect(port).toBeLessThanOrEqual(LOGIN_CALLBACK.portRange.max);
  });

  it("skips occupied ports and returns the next available one", async () => {
    const blocker = createServer();
    await new Promise<void>((resolve) =>
      blocker.listen(LOGIN_CALLBACK.portRange.min, "127.0.0.1", resolve)
    );

    try {
      const port = await findAvailablePort();
      expect(port).toBeGreaterThan(LOGIN_CALLBACK.portRange.min);
      expect(port).toBeLessThanOrEqual(LOGIN_CALLBACK.portRange.max);
    } finally {
      blocker.close();
    }
  });

  it("rejects when all ports in range are occupied", async () => {
    const blockers: ReturnType<typeof createServer>[] = [];
    const { min, max } = LOGIN_CALLBACK.portRange;

    for (let p = min; p <= max; p++) {
      const s = createServer();
      await new Promise<void>((resolve) => s.listen(p, "127.0.0.1", resolve));
      blockers.push(s);
    }

    try {
      await expect(findAvailablePort()).rejects.toThrow(
        LOGIN_MESSAGES.noAvailablePort
      );
    } finally {
      blockers.forEach((s) => s.close());
    }
  });
});

describe("startCallbackServer", () => {
  let server: TCallbackServer | null = null;

  afterEach(() => {
    if (server) {
      server.shutdown();
      server = null;
    }
  });

  it("resolves with port in range, 64-char hex state, waitForCallback, and shutdown", async () => {
    server = await startCallbackServer({ timeoutMs: 5000 });

    expect(server.port).toBeGreaterThanOrEqual(LOGIN_CALLBACK.portRange.min);
    expect(server.port).toBeLessThanOrEqual(LOGIN_CALLBACK.portRange.max);
    expect(server.state).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof server.waitForCallback).toBe("function");
    expect(typeof server.shutdown).toBe("function");
  });

  it("responds 200 with success HTML on valid callback and resolves waitForCallback", async () => {
    server = await startCallbackServer({ timeoutMs: 5000 });
    const { port, state, waitForCallback } = server;

    const callbackPromise = waitForCallback();
    const response = await fetch(
      `http://127.0.0.1:${port}/callback?api_key=test_key&state=${state}`
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Authentication Successful");

    const result = await callbackPromise;
    expect(result.apiKey).toBe("test_key");
  });

  it("responds 403 on wrong state and waitForCallback does not resolve", async () => {
    server = await startCallbackServer({ timeoutMs: 5000 });
    const { port } = server;
    const waitPromise = server.waitForCallback();

    const response = await fetch(
      `http://127.0.0.1:${port}/callback?api_key=test_key&state=wrong_state`
    );

    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain("Authentication Failed");

    const raceResult = await Promise.race([
      waitPromise.then(() => "resolved"),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("timeout"), 100)
      ),
    ]);
    expect(raceResult).toBe("timeout");
  });

  it("responds 400 on missing api_key and waitForCallback does not resolve", async () => {
    server = await startCallbackServer({ timeoutMs: 5000 });
    const { port, state } = server;
    const waitPromise = server.waitForCallback();

    const response = await fetch(
      `http://127.0.0.1:${port}/callback?state=${state}`
    );

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain("Authentication Failed");

    const raceResult = await Promise.race([
      waitPromise.then(() => "resolved"),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("timeout"), 100)
      ),
    ]);
    expect(raceResult).toBe("timeout");
  });

  it("responds 404 on other paths", async () => {
    server = await startCallbackServer({ timeoutMs: 5000 });
    const { port } = server;

    const response = await fetch(`http://127.0.0.1:${port}/other-path`);
    expect(response.status).toBe(404);
  });

  it("rejects waitForCallback on timeout with callbackTimeout message", async () => {
    server = await startCallbackServer({ timeoutMs: 100 });

    await expect(server.waitForCallback()).rejects.toThrow(
      LOGIN_MESSAGES.callbackTimeout
    );
  });

  it("shuts down the server — subsequent requests fail", async () => {
    server = await startCallbackServer({ timeoutMs: 5000 });
    const { port } = server;

    server.shutdown();
    server = null;

    await expect(fetch(`http://127.0.0.1:${port}/callback`)).rejects.toThrow();
  });

  it("shutdown rejects pending waitForCallback with cancelMessage", async () => {
    server = await startCallbackServer({ timeoutMs: 5000 });
    const waitPromise = server.waitForCallback();

    server.shutdown();
    server = null;

    await expect(waitPromise).rejects.toThrow(LOGIN_MESSAGES.cancelMessage);
  });

  it("multiple invalid requests followed by valid — waitForCallback resolves correctly", async () => {
    server = await startCallbackServer({ timeoutMs: 5000 });
    const { port, state } = server;
    const callbackPromise = server.waitForCallback();

    await fetch(`http://127.0.0.1:${port}/callback?api_key=key1&state=wrong`);
    await fetch(`http://127.0.0.1:${port}/callback?state=${state}`);
    await fetch(
      `http://127.0.0.1:${port}/callback?api_key=final_key&state=${state}`
    );

    const result = await callbackPromise;
    expect(result.apiKey).toBe("final_key");
  });
});

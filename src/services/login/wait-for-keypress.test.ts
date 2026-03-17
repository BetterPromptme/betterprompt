import { afterEach, describe, expect, it, mock } from "bun:test";

import { waitForKeypress } from "./wait-for-keypress";

type TStdinLike = {
  isTTY: boolean;
  isRaw: boolean;
  setRawMode: (mode: boolean) => void;
  once: (event: string, listener: (data: Buffer) => void) => void;
  removeListener: (event: string, listener: (data: Buffer) => void) => void;
  resume: () => void;
  pause: () => void;
};

const makeStdin = (overrides: Partial<TStdinLike> = {}): TStdinLike => ({
  isTTY: true,
  isRaw: false,
  setRawMode: mock((mode: boolean) => {
    stdin.isRaw = mode;
  }),
  once: mock(() => {}),
  removeListener: mock(() => {}),
  resume: mock(() => {}),
  pause: mock(() => {}),
  ...overrides,
});

let stdin: TStdinLike;

afterEach(() => {
  mock.restore();
});

describe("waitForKeypress", () => {
  it("Enter keypress resolves with 'enter'", async () => {
    stdin = makeStdin();
    let listener: ((data: Buffer) => void) | null = null;
    stdin.once = mock((_event: string, cb: (data: Buffer) => void) => {
      listener = cb;
    });

    const promise = waitForKeypress({ stdin });
    // Simulate Enter key (0x0d)
    listener!(Buffer.from([0x0d]));

    const result = await promise;
    expect(result).toBe("enter");
  });

  it("Newline (0x0a) also resolves with 'enter'", async () => {
    stdin = makeStdin();
    let listener: ((data: Buffer) => void) | null = null;
    stdin.once = mock((_event: string, cb: (data: Buffer) => void) => {
      listener = cb;
    });

    const promise = waitForKeypress({ stdin });
    listener!(Buffer.from([0x0a]));

    const result = await promise;
    expect(result).toBe("enter");
  });

  it("Ctrl+C (0x03) resolves with 'cancel'", async () => {
    stdin = makeStdin();
    let listener: ((data: Buffer) => void) | null = null;
    stdin.once = mock((_event: string, cb: (data: Buffer) => void) => {
      listener = cb;
    });

    const promise = waitForKeypress({ stdin });
    listener!(Buffer.from([0x03]));

    const result = await promise;
    expect(result).toBe("cancel");
  });

  it("AbortSignal cleans up listener and restores raw mode", async () => {
    stdin = makeStdin();
    const controller = new AbortController();

    stdin.once = mock((_event: string, _cb: (data: Buffer) => void) => {});

    const promise = waitForKeypress({ stdin }, controller.signal);

    // Abort the signal
    controller.abort();

    // Give the abort handler time to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdin.removeListener).toHaveBeenCalled();
    expect(stdin.isRaw).toBe(false);
    expect(stdin.pause).toHaveBeenCalled();

    // Promise should never resolve (orphaned)
    const raceResult = await Promise.race([
      promise.then(() => "resolved"),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 10)),
    ]);
    expect(raceResult).toBe("timeout");
  });

  it("non-TTY returns never-resolving promise", async () => {
    stdin = makeStdin({ isTTY: false });

    const promise = waitForKeypress({ stdin });

    const raceResult = await Promise.race([
      promise.then(() => "resolved"),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 10)),
    ]);
    expect(raceResult).toBe("timeout");
    expect(stdin.setRawMode).not.toHaveBeenCalled();
  });

  it("raw mode is restored after Enter resolution", async () => {
    stdin = makeStdin();
    let listener: ((data: Buffer) => void) | null = null;
    stdin.once = mock((_event: string, cb: (data: Buffer) => void) => {
      listener = cb;
    });

    const promise = waitForKeypress({ stdin });
    expect(stdin.isRaw).toBe(true);

    listener!(Buffer.from([0x0d]));
    await promise;

    expect(stdin.isRaw).toBe(false);
    expect(stdin.pause).toHaveBeenCalled();
  });

  it("listener is removed after resolution", async () => {
    stdin = makeStdin();
    let listener: ((data: Buffer) => void) | null = null;
    stdin.once = mock((_event: string, cb: (data: Buffer) => void) => {
      listener = cb;
    });

    const promise = waitForKeypress({ stdin });
    listener!(Buffer.from([0x0d]));
    await promise;

    expect(stdin.removeListener).toHaveBeenCalledWith("data", listener);
  });

  it("abort after resolution does not double-cleanup stdin", async () => {
    stdin = makeStdin();
    let listener: ((data: Buffer) => void) | null = null;
    stdin.once = mock((_event: string, cb: (data: Buffer) => void) => {
      listener = cb;
    });

    const controller = new AbortController();
    const promise = waitForKeypress({ stdin }, controller.signal);

    // Resolve via Enter
    listener!(Buffer.from([0x0d]));
    await promise;

    // Reset call counts after first cleanup
    (stdin.setRawMode as ReturnType<typeof mock>).mockClear();
    (stdin.pause as ReturnType<typeof mock>).mockClear();

    // Abort fires after promise already resolved
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // cleanup() should be a no-op — no second setRawMode/pause call
    expect(stdin.setRawMode).not.toHaveBeenCalled();
    expect(stdin.pause).not.toHaveBeenCalled();
  });

  it("other keys are ignored — re-listens for next key", async () => {
    stdin = makeStdin();
    const listeners: Array<(data: Buffer) => void> = [];
    stdin.once = mock((_event: string, cb: (data: Buffer) => void) => {
      listeners.push(cb);
    });

    const promise = waitForKeypress({ stdin });

    // Send a random key (e.g., 'a' = 0x61)
    listeners[0]!(Buffer.from([0x61]));

    // Should have re-registered once
    expect(listeners.length).toBe(2);

    // Now send Enter
    listeners[1]!(Buffer.from([0x0d]));

    const result = await promise;
    expect(result).toBe("enter");
  });
});

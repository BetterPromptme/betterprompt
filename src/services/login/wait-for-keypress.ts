type TStdinLike = {
  isTTY: boolean;
  isRaw: boolean;
  setRawMode: (mode: boolean) => void;
  once: (event: string, listener: (data: Buffer) => void) => void;
  removeListener: (event: string, listener: (data: Buffer) => void) => void;
  resume: () => void;
  pause: () => void;
};

type TWaitForKeypressDeps = {
  stdin: TStdinLike;
};

const ENTER_CR = 0x0d;
const ENTER_LF = 0x0a;
const CTRL_C = 0x03;

const defaultDeps: TWaitForKeypressDeps = {
  stdin: process.stdin as unknown as TStdinLike,
};

export const waitForKeypress = (
  deps: TWaitForKeypressDeps = defaultDeps,
  signal?: AbortSignal
): Promise<"enter" | "cancel"> => {
  const { stdin } = deps;

  if (!stdin.isTTY) {
    return new Promise<"enter" | "cancel">(() => {});
  }

  return new Promise<"enter" | "cancel">((resolve) => {
    const previousRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      stdin.removeListener("data", onData);
      stdin.setRawMode(previousRaw);
      stdin.pause();
    };

    const onData = (data: Buffer): void => {
      const byte = data[0];
      if (byte === ENTER_CR || byte === ENTER_LF) {
        cleanup();
        resolve("enter");
      } else if (byte === CTRL_C) {
        cleanup();
        resolve("cancel");
      } else {
        // Ignore other keys, re-listen
        stdin.once("data", onData);
      }
    };

    stdin.once("data", onData);

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          cleanup();
        },
        { once: true }
      );
    }
  });
};

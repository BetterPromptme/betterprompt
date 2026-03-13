import { afterEach, describe, expect, it, mock } from "bun:test";

import type { TCtrlCHandle } from "../../types/error-ux";
import {
  getGlobalCtrlCHandle,
  pauseGlobalSigint,
  resetGlobalCtrlCHandleForTests,
  resumeGlobalSigint,
  setGlobalCtrlCHandle,
} from "./handle";

describe("global SIGINT handle singleton", () => {
  afterEach(() => {
    resetGlobalCtrlCHandleForTests();
  });

  it("getGlobalCtrlCHandle returns undefined when no handle is set", () => {
    expect(getGlobalCtrlCHandle()).toBeUndefined();
  });

  it("setGlobalCtrlCHandle stores the handle and getGlobalCtrlCHandle retrieves it", () => {
    const handle: TCtrlCHandle = {
      uninstall: mock(() => {}),
      pause: mock(() => {}),
      resume: mock(() => {}),
    };

    setGlobalCtrlCHandle(handle);

    expect(getGlobalCtrlCHandle()).toBe(handle);
  });

  it("pauseGlobalSigint calls handle.pause() when a handle is set", () => {
    const handle: TCtrlCHandle = {
      uninstall: mock(() => {}),
      pause: mock(() => {}),
      resume: mock(() => {}),
    };

    setGlobalCtrlCHandle(handle);
    pauseGlobalSigint();

    expect(handle.pause).toHaveBeenCalledTimes(1);
  });

  it("pauseGlobalSigint silently no-ops when no handle is set", () => {
    expect(() => pauseGlobalSigint()).not.toThrow();
  });

  it("resumeGlobalSigint calls handle.resume() when a handle is set", () => {
    const handle: TCtrlCHandle = {
      uninstall: mock(() => {}),
      pause: mock(() => {}),
      resume: mock(() => {}),
    };

    setGlobalCtrlCHandle(handle);
    resumeGlobalSigint();

    expect(handle.resume).toHaveBeenCalledTimes(1);
  });

  it("resumeGlobalSigint silently no-ops when no handle is set", () => {
    expect(() => resumeGlobalSigint()).not.toThrow();
  });

  it("resetGlobalCtrlCHandleForTests clears the stored handle", () => {
    const handle: TCtrlCHandle = {
      uninstall: mock(() => {}),
      pause: mock(() => {}),
      resume: mock(() => {}),
    };

    setGlobalCtrlCHandle(handle);
    resetGlobalCtrlCHandleForTests();

    expect(getGlobalCtrlCHandle()).toBeUndefined();
  });
});

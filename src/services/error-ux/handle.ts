import type { TCtrlCHandle } from "../../types/error-ux";

let globalHandle: TCtrlCHandle | undefined;

export const setGlobalCtrlCHandle = (handle: TCtrlCHandle): void => {
  globalHandle = handle;
};

export const getGlobalCtrlCHandle = (): TCtrlCHandle | undefined => {
  return globalHandle;
};

export const pauseGlobalSigint = (): void => {
  globalHandle?.pause();
};

export const resumeGlobalSigint = (): void => {
  globalHandle?.resume();
};

export const resetGlobalCtrlCHandleForTests = (): void => {
  globalHandle = undefined;
};

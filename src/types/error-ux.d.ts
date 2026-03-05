export type TErrorFormatterOptions = {
  color: boolean;
};

export type TFormatErrorMessage = (prefix: string, message: string) => string;

export type TSpinnerLike = {
  start: () => TSpinnerLike;
  succeed: (text?: string) => TSpinnerLike;
  fail: (text?: string) => TSpinnerLike;
};

export type TSpinnerFactory = (message: string) => TSpinnerLike;

export type TRunTaskWithSpinnerOptions<TResult> = {
  message: string;
  createSpinner: TSpinnerFactory;
  task: () => Promise<TResult>;
};

export type TSignalName = "SIGINT";

export type TSignalHandler = () => void;

export type TInstallCtrlCHandlerOptions = {
  register: (signal: TSignalName, handler: TSignalHandler) => void;
  unregister: (signal: TSignalName, handler: TSignalHandler) => void;
  cleanup: () => void;
  setExitCode: (code: number) => void;
  log: (message: string) => void;
};

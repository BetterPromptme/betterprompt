import type { RunStatus } from "../../enums/run-status";

export type TOutputsCommandOptions = {
  sync?: boolean;
  remote?: boolean;
};

export type TOutputsListCommandOptions = {
  remote?: boolean;
  status?: RunStatus;
  limit?: string;
  since?: string;
};

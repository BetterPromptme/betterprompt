export type TScope =
  | { type: "global" }
  | { type: "project" }
  | { type: "dir"; path: string };

export type TVerbosity = "normal" | "quiet" | "verbose";

export type TCliContext = {
  scope: TScope;
  outputFormat: "text" | "json";
  verbosity: TVerbosity;
  registry?: string;
  yes: boolean;
  color: boolean;
};

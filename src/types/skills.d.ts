export type TSkillInfoOptions = {
  version?: string;
  examples?: boolean;
  schema?: boolean;
  pricing?: boolean;
};

export type TSkillInfoCommandOptions = TSkillInfoOptions;

export type TSkillInstallScope =
  | { type: "global" }
  | { type: "project" }
  | { type: "dir"; path: string };

export type TSkillInstallOptions = {
  scope: TSkillInstallScope;
  overwrite?: boolean;
};

export type TSkillInstallCommandOptions = {
  overwrite?: boolean;
};

export type TSkillUninstallOptions = {
  scope: TSkillInstallScope;
};

export type TSkillUninstallCommandOptions = Record<string, never>;

export type TSkillListOptions = {
  scope: TSkillInstallScope;
};

export type TSkillListCommandOptions = Record<string, never>;

export type TSkillUpdateOptions = {
  scope: TSkillInstallScope;
  force?: boolean;
};

export type TSkillUpdateCommandOptions = {
  force?: boolean;
  all?: boolean;
};

export type TSkillInstallScope =
  | { type: "global" }
  | { type: "project" }
  | { type: "dir"; path: string };

export type TSkillInstallOptions = {
  scope: TSkillInstallScope;
  overwrite?: boolean;
  agents?: string[];
};

export type TSkillInstallCommandOptions = {
  overwrite?: boolean;
  agent?: string[];
};

export type TSkillUninstallOptions = {
  scope: TSkillInstallScope;
  agent?: string;
};

export type TSkillUninstallCommandOptions = {
  agent?: string;
};

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

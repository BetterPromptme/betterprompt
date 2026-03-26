export type TInstallScopeType = "global" | "project" | "dir";

export type TInstallScope = {
  type: TInstallScopeType;
  rootDir: string;
};

export type TInstallSkillOptions = {
  skillName: string;
  scope: TInstallScope;
  overwrite?: boolean;
  agents?: string[];
};

export type TInstallSkillResult = {
  skillName: string;
  installPath: string;
};

export type TUninstallSkillOptions = {
  skillName: string;
  scope: TInstallScope;
  agent?: string;
};

export type TUninstallSkillResult = {
  skillName: string;
  removedAgents: string[];
};

export type TInstallApiClient = {
  get: <TResponse = unknown>(path: string) => Promise<TResponse>;
};

export type TListSkillsOptions = {
  scope: TInstallScope;
};

export type TSkillSummary = {
  name: string;
  title?: string;
  skillmdUrl?: string;
  installedAgents?: string[];
};

export type TListSkillsResult = TSkillSummary[];

export type TUpdateSkillOptions = {
  skillName: string;
  scope: TInstallScope;
  force?: boolean;
};

export type TUpdateSkillResult = {
  skillName: string;
  updated: boolean;
  from?: string;
  to?: string;
};

export type TUpdateAllSkillsOptions = {
  scope: TInstallScope;
  force?: boolean;
};

export type TUpdateAllSkillsResult = TUpdateSkillResult[];

export type TInstallScopeType = "global" | "project" | "dir";

export type TInstallScope = {
  type: TInstallScopeType;
  rootDir: string;
};

export type TInstallSkillOptions = {
  skillName: string;
  scope: TInstallScope;
  overwrite?: boolean;
};

export type TInstallSkillResult = {
  skillName: string;
  installPath: string;
};

export type TUninstallSkillOptions = {
  skillName: string;
  scope: TInstallScope;
};

export type TUninstallSkillResult = {
  skillName: string;
  removedPath: string;
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
  version?: string;
};

export type TListSkillsResult = TSkillSummary[];

export type TUpdateSkillOptions = {
  skillName: string;
  scope: TInstallScope;
  force?: boolean;
};

export type TUpdateSkillResult = {
  skillName: string;
  fromVersion: string | undefined;
  toVersion: string;
  updated: boolean;
};

export type TUpdateAllSkillsOptions = {
  scope: TInstallScope;
  force?: boolean;
};

export type TUpdateAllSkillsResult = TUpdateSkillResult[];

export type TInstallMethod = "binary" | "package-manager";

export type TInstallMethodInfo = {
  method: TInstallMethod;
  execPath: string;
  installDir: string;
  binDir: string;
};

export type TGitHubRelease = {
  tag_name?: string;
};

export type TPlatformInfo = {
  os: string;
  arch: string;
};

export type TCheckForUpdateOptions = {
  registry?: string;
};

export type TCheckForUpdateResult = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
};

export type TPerformUpdateOptions = {
  registry?: string;
  targetVersion?: string;
};

export type TPerformUpdateResult = {
  updated: boolean;
};

export type TUpdateCommandDependencies = {
  checkForUpdate: (
    options?: TCheckForUpdateOptions
  ) => Promise<TCheckForUpdateResult>;
  performUpdate: (
    options?: TPerformUpdateOptions
  ) => Promise<TPerformUpdateResult>;
};

import {
  access,
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type {
  TInstallApiClient,
  TInstallSkillOptions,
  TInstallSkillResult,
  TListSkillsOptions,
  TListSkillsResult,
  TSkillSummary,
  TUninstallSkillOptions,
  TUninstallSkillResult,
  TUpdateAllSkillsOptions,
  TUpdateAllSkillsResult,
  TUpdateSkillOptions,
  TUpdateSkillResult,
} from "../../types/installer";
import type {
  TSkillInstallOptions,
  TSkillListOptions,
  TSkillUninstallOptions,
  TSkillUpdateOptions,
} from "../../types/skills";
import { generateZodSchema } from "../../utils/schema";
import { getApiClient } from "../api/client";
import { resolveScope } from "../scope/service";
import type { TSkillSearchRow } from "./service";
import { getSkillByName } from "./service";
import { validateSkillName } from "./skill-name";

const fetchSkillmd = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch SKILL.md from ${url}: ${response.status}`);
  }
  return response.text();
};

type TSkillManifest = Omit<TSkillSearchRow, "skillId">;

const SHORT_SHA_LENGTH = 7;

const extractShortSha = (
  skillmdUrl: string | undefined
): string | undefined => {
  if (!skillmdUrl) return undefined;
  try {
    const segments = new URL(skillmdUrl).pathname.split("/");
    const sha = segments[3];
    return sha && sha.length >= SHORT_SHA_LENGTH
      ? sha.slice(0, SHORT_SHA_LENGTH)
      : undefined;
  } catch {
    return undefined;
  }
};

const exists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};
const AGENT_DIRS = [
  ".agents",
  ".openclaw",
  ".cursor",
  ".claude",
  ".windsurf",
  ".antigravity",
];

const SYMLINK_TARGETS = AGENT_DIRS.map((dir) => path.join(dir, "skills"));

const isSymlinkSupported = (): boolean =>
  process.platform === "darwin" || process.platform === "linux";

const createSkillSymlinks = async (
  skillName: string,
  skillDir: string,
  overwrite?: boolean
): Promise<void> => {
  if (!isSymlinkSupported()) return;

  const home = homedir();

  for (const target of SYMLINK_TARGETS) {
    try {
      const parentDir = path.join(home, target);
      if (!(await exists(parentDir))) continue;

      const linkPath = path.join(parentDir, skillName);
      const linkExists = await exists(linkPath);

      if (linkExists && overwrite) {
        const stat = await lstat(linkPath);
        if (stat.isSymbolicLink()) {
          await unlink(linkPath);
        } else {
          continue;
        }
      } else if (linkExists) {
        continue;
      }

      await symlink(skillDir, linkPath);
    } catch {
      // best-effort: skip on any error
    }
  }
};

const writeJsonFile = async (
  targetPath: string,
  value: unknown
): Promise<void> => {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeMdFile = async (
  targetPath: string,
  content: string
): Promise<void> => {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  await writeFile(targetPath, normalized, "utf8");
};

const resolveInstallerScope = async (
  scope: TSkillInstallOptions["scope"]
): Promise<TInstallSkillOptions["scope"]> => {
  return resolveScope({
    scope,
    outputFormat: "text",
    verbosity: "normal",
    yes: false,
    color: true,
  });
};

const installSkillCore = async (
  apiClient: TInstallApiClient,
  options: TInstallSkillOptions
): Promise<TInstallSkillResult> => {
  const normalizedSkillName = validateSkillName(options.skillName);
  const skillDir = path.join(
    options.scope.rootDir,
    "skills",
    normalizedSkillName
  );
  const isAlreadyInstalled = await exists(skillDir);

  if (isAlreadyInstalled && !options.overwrite) {
    throw new Error(`Skill "${normalizedSkillName}" is already installed.`);
  }

  const response = await getSkillByName(apiClient, normalizedSkillName);
  const { inputMetadata, ...manifest } = response;
  const skillmd = await fetchSkillmd(manifest.metadata.skillmdUrl);
  const schema = generateZodSchema(inputMetadata).toJSONSchema();

  if (isAlreadyInstalled) {
    await rm(skillDir, { recursive: true, force: true });
  }

  await mkdir(skillDir, { recursive: true });
  await writeJsonFile(path.join(skillDir, "manifest.json"), manifest);
  await writeJsonFile(path.join(skillDir, "schema.json"), schema);
  await writeMdFile(path.join(skillDir, "SKILL.md"), skillmd);

  await createSkillSymlinks(normalizedSkillName, skillDir, options.overwrite);

  return {
    skillName: normalizedSkillName,
    installPath: skillDir,
  };
};

const uninstallSkillCore = async (
  options: TUninstallSkillOptions
): Promise<TUninstallSkillResult> => {
  const normalizedSkillName = validateSkillName(options.skillName);
  const skillDir = path.join(
    options.scope.rootDir,
    "skills",
    normalizedSkillName
  );
  const isInstalled = await exists(skillDir);

  if (!isInstalled) {
    throw new Error(`Skill "${normalizedSkillName}" is not installed.`);
  }

  await rm(skillDir, { recursive: true, force: true });

  return {
    skillName: normalizedSkillName,
    removedPath: skillDir,
  };
};

const listSkillsCore = async (
  options: TListSkillsOptions
): Promise<TListSkillsResult> => {
  const skillsDir = path.join(options.scope.rootDir, "skills");
  const skillsDirExists = await exists(skillsDir);

  if (!skillsDirExists) {
    return [];
  }

  const entries = await readdir(skillsDir, { withFileTypes: true });
  const skills: TSkillSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(skillsDir, entry.name, "manifest.json");
    try {
      const raw = await readFile(manifestPath, "utf8");
      const manifest = JSON.parse(raw) as TSkillManifest;
      skills.push({
        name: entry.name,
        title: typeof manifest.title === "string" ? manifest.title : undefined,
        skillmdUrl:
          typeof manifest.metadata?.skillmdUrl === "string"
            ? manifest.metadata.skillmdUrl
            : undefined,
      });
    } catch {
      skills.push({ name: entry.name });
    }
  }

  return skills;
};

const updateSkillCore = async (
  apiClient: TInstallApiClient,
  options: TUpdateSkillOptions
): Promise<TUpdateSkillResult> => {
  const normalizedSkillName = validateSkillName(options.skillName);
  const skillDir = path.join(
    options.scope.rootDir,
    "skills",
    normalizedSkillName
  );
  const isInstalled = await exists(skillDir);

  if (!isInstalled) {
    throw new Error(`Skill "${normalizedSkillName}" is not installed.`);
  }

  let localSkillmdUrl: string | undefined;
  try {
    const raw = await readFile(path.join(skillDir, "manifest.json"), "utf8");
    const manifest = JSON.parse(raw) as TSkillManifest;
    localSkillmdUrl = manifest.metadata?.skillmdUrl;
  } catch {
    localSkillmdUrl = undefined;
  }

  const response = await getSkillByName(apiClient, normalizedSkillName);
  const { inputMetadata, ...latestManifest } = response;
  const remoteSkillmdUrl = latestManifest.metadata.skillmdUrl;

  const fromSha = extractShortSha(localSkillmdUrl);
  const toSha = extractShortSha(remoteSkillmdUrl);

  if (localSkillmdUrl === remoteSkillmdUrl && !options.force) {
    return {
      skillName: normalizedSkillName,
      updated: false,
    };
  }

  const skillmd = await fetchSkillmd(remoteSkillmdUrl);
  const schema = generateZodSchema(inputMetadata).toJSONSchema();

  await rm(skillDir, { recursive: true, force: true });
  await mkdir(skillDir, { recursive: true });
  await writeJsonFile(path.join(skillDir, "manifest.json"), latestManifest);
  await writeJsonFile(path.join(skillDir, "schema.json"), schema);
  await writeMdFile(path.join(skillDir, "SKILL.md"), skillmd);

  await createSkillSymlinks(normalizedSkillName, skillDir, true);

  return {
    skillName: normalizedSkillName,
    updated: true,
    from: fromSha,
    to: toSha,
  };
};

const updateAllSkillsCore = async (
  apiClient: TInstallApiClient,
  options: TUpdateAllSkillsOptions
): Promise<TUpdateAllSkillsResult> => {
  const installedSkills = await listSkillsCore({ scope: options.scope });

  if (installedSkills.length === 0) {
    return [];
  }

  const results: TUpdateSkillResult[] = [];
  for (const skill of installedSkills) {
    const result = await updateSkillCore(apiClient, {
      skillName: skill.name,
      scope: options.scope,
      force: options.force,
    });
    results.push(result);
  }

  return results;
};

export const installSkill = async (
  skillName: string,
  options: TSkillInstallOptions
): Promise<TInstallSkillResult> => {
  const resolvedScope = await resolveInstallerScope(options.scope);

  return installSkillCore(getApiClient(), {
    skillName,
    scope: resolvedScope,
    overwrite: options.overwrite,
  });
};

export const uninstallSkill = async (
  skillName: string,
  options: TSkillUninstallOptions
): Promise<TUninstallSkillResult> => {
  const resolvedScope = await resolveInstallerScope(options.scope);

  return uninstallSkillCore({
    skillName,
    scope: resolvedScope,
  });
};

export const listSkills = async (
  options: TSkillListOptions
): Promise<TListSkillsResult> => {
  const resolvedScope = await resolveInstallerScope(options.scope);

  return listSkillsCore({
    scope: resolvedScope,
  });
};

export const updateSkill = async (
  skillName: string,
  options: TSkillUpdateOptions
): Promise<TUpdateSkillResult> => {
  const resolvedScope = await resolveInstallerScope(options.scope);

  return updateSkillCore(getApiClient(), {
    skillName,
    scope: resolvedScope,
    force: options.force,
  });
};

export const updateAllSkills = async (
  options: TSkillUpdateOptions
): Promise<TUpdateAllSkillsResult> => {
  const resolvedScope = await resolveInstallerScope(options.scope);

  return updateAllSkillsCore(getApiClient(), {
    scope: resolvedScope,
    force: options.force,
  });
};

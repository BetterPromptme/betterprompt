import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  AGENT_DIR_NAMES,
  agentDirNotFoundError,
  agentNotSupportedError,
} from "../../constants/skills";
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

type TSkillManifestOnDisk = TSkillManifest & {
  installedAgents?: string[];
};

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

const validateAgent = async (agentName: string): Promise<void> => {
  if (!(AGENT_DIR_NAMES as readonly string[]).includes(agentName)) {
    throw new Error(agentNotSupportedError(agentName));
  }
  const agentDirPath = path.join(homedir(), `.${agentName}`);
  if (!(await exists(agentDirPath))) {
    throw new Error(agentDirNotFoundError(agentName));
  }
};

const copySkillToAgent = async (
  agentName: string,
  skillName: string,
  skillDir: string
): Promise<void> => {
  const agentSkillDir = path.join(
    homedir(),
    `.${agentName}`,
    "skills",
    skillName
  );
  await mkdir(agentSkillDir, { recursive: true });
  await copyFile(
    path.join(skillDir, "SKILL.md"),
    path.join(agentSkillDir, "SKILL.md")
  );
};

const readManifestFromDisk = async (
  skillDir: string
): Promise<TSkillManifestOnDisk | undefined> => {
  try {
    const raw = await readFile(path.join(skillDir, "manifest.json"), "utf8");
    return JSON.parse(raw) as TSkillManifestOnDisk;
  } catch {
    return undefined;
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

  const requestedAgents = options.agents ?? [];
  for (const agent of requestedAgents) {
    await validateAgent(agent);
  }

  let existingAgents: string[] = [];
  if (isAlreadyInstalled) {
    const oldManifest = await readManifestFromDisk(skillDir);
    existingAgents = oldManifest?.installedAgents ?? [];
    await rm(skillDir, { recursive: true, force: true });
  }

  const response = await getSkillByName(apiClient, normalizedSkillName);
  const { inputMetadata, ...manifest } = response;
  const skillmd = await fetchSkillmd(manifest.metadata.skillmdUrl);
  const schema = generateZodSchema(inputMetadata).toJSONSchema();

  const mergedAgents = Array.from(
    new Set([...existingAgents, ...requestedAgents])
  );

  await mkdir(skillDir, { recursive: true });
  await writeJsonFile(path.join(skillDir, "manifest.json"), {
    ...manifest,
    installedAgents: mergedAgents,
  });
  await writeJsonFile(path.join(skillDir, "schema.json"), schema);
  await writeMdFile(path.join(skillDir, "SKILL.md"), skillmd);

  for (const agent of mergedAgents) {
    try {
      await copySkillToAgent(agent, normalizedSkillName, skillDir);
    } catch {
      // best-effort for previously installed agents
    }
  }

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

  if (options.agent && options.agent !== "*") {
    await validateAgent(options.agent);
  }

  const oldManifest = await readManifestFromDisk(skillDir);
  const currentAgents = oldManifest?.installedAgents ?? [];

  const agentsToRemove =
    options.agent === "*"
      ? currentAgents
      : options.agent
        ? [options.agent]
        : [];

  const home = homedir();
  for (const agent of agentsToRemove) {
    try {
      const agentSkillDir = path.join(
        home,
        `.${agent}`,
        "skills",
        normalizedSkillName
      );
      if (await exists(agentSkillDir)) {
        await rm(agentSkillDir, { recursive: true, force: true });
      }
    } catch {
      // best-effort
    }
  }

  const remainingAgents = currentAgents.filter(
    (a) => !agentsToRemove.includes(a)
  );
  if (oldManifest) {
    await writeJsonFile(path.join(skillDir, "manifest.json"), {
      ...oldManifest,
      installedAgents: remainingAgents,
    });
  }

  return {
    skillName: normalizedSkillName,
    removedAgents: agentsToRemove,
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
      const manifest = JSON.parse(raw) as TSkillManifestOnDisk;
      skills.push({
        name: entry.name,
        title: typeof manifest.title === "string" ? manifest.title : undefined,
        skillmdUrl:
          typeof manifest.metadata?.skillmdUrl === "string"
            ? manifest.metadata.skillmdUrl
            : undefined,
        installedAgents: Array.isArray(manifest.installedAgents)
          ? manifest.installedAgents
          : [],
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

  const oldManifest = await readManifestFromDisk(skillDir);
  const localSkillmdUrl = oldManifest?.metadata?.skillmdUrl;
  const preservedAgents = oldManifest?.installedAgents ?? [];

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
  await writeJsonFile(path.join(skillDir, "manifest.json"), {
    ...latestManifest,
    installedAgents: preservedAgents,
  });
  await writeJsonFile(path.join(skillDir, "schema.json"), schema);
  await writeMdFile(path.join(skillDir, "SKILL.md"), skillmd);

  for (const agent of preservedAgents) {
    try {
      await copySkillToAgent(agent, normalizedSkillName, skillDir);
    } catch {
      // best-effort
    }
  }

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
    agents: options.agents,
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
    agent: options.agent,
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

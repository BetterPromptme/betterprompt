import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
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
} from "../types/installer";
import { generateZodSchema } from "../utils/schema";
import { validateSkillName } from "./skill-name";
import { getSkillByName, TSkillSearchRow } from "./skills";

type TSkillManifest = Omit<TSkillSearchRow, "skillId" | "inputMetadata">;

const exists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
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

export const installSkill = async (
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

  const { skillmd, inputMetadata, ...manifest } = response;

  const schema = generateZodSchema(inputMetadata).toJSONSchema();

  if (isAlreadyInstalled) {
    await rm(skillDir, { recursive: true, force: true });
  }

  await mkdir(skillDir, { recursive: true });
  await writeJsonFile(path.join(skillDir, "manifest.json"), manifest);
  await writeJsonFile(path.join(skillDir, "schema.json"), schema);
  await writeMdFile(path.join(skillDir, "SKILL.md"), skillmd ?? "");

  const installResult: TInstallSkillResult = {
    skillName: normalizedSkillName,
    installPath: skillDir,
  };

  return installResult;
};

export const uninstallSkill = async (
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

export const listSkills = async (
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
        version:
          typeof manifest.skillVersionId === "string"
            ? manifest.skillVersionId
            : undefined,
      });
    } catch {
      skills.push({ name: entry.name });
    }
  }

  return skills;
};

export const updateSkill = async (
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

  let fromVersion: string | undefined;
  try {
    const raw = await readFile(path.join(skillDir, "manifest.json"), "utf8");
    const manifest = JSON.parse(raw) as TSkillManifest;
    fromVersion =
      typeof manifest.skillVersionId === "string"
        ? manifest.skillVersionId
        : undefined;
  } catch {
    fromVersion = undefined;
  }

  const response = await getSkillByName(apiClient, normalizedSkillName);

  const { skillmd, inputMetadata, ...latestManifest } = response;

  const toVersion =
    typeof latestManifest.skillVersionId === "string"
      ? latestManifest.skillVersionId
      : "latest";

  if (fromVersion === toVersion && !options.force) {
    return {
      skillName: normalizedSkillName,
      fromVersion,
      toVersion,
      updated: false,
    };
  }

  const schema = generateZodSchema(inputMetadata).toJSONSchema();

  await rm(skillDir, { recursive: true, force: true });
  await mkdir(skillDir, { recursive: true });
  await writeJsonFile(path.join(skillDir, "manifest.json"), latestManifest);
  await writeJsonFile(path.join(skillDir, "schema.json"), schema);
  await writeMdFile(path.join(skillDir, "SKILL.md"), skillmd ?? "");

  return {
    skillName: normalizedSkillName,
    fromVersion,
    toVersion,
    updated: true,
  };
};

export const updateAllSkills = async (
  apiClient: TInstallApiClient,
  options: TUpdateAllSkillsOptions
): Promise<TUpdateAllSkillsResult> => {
  const installedSkills = await listSkills({ scope: options.scope });

  if (installedSkills.length === 0) {
    return [];
  }

  const results: TUpdateSkillResult[] = [];
  for (const skill of installedSkills) {
    const result = await updateSkill(apiClient, {
      skillName: skill.name,
      scope: options.scope,
      force: options.force,
    });
    results.push(result);
  }

  return results;
};

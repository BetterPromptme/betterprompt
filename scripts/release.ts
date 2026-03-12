import { $ } from "bun";

const USAGE = "Usage: bun run release [patch|minor|major]";
const type = Bun.argv[2];

if (!type || !["patch", "minor", "major"].includes(type)) {
  console.error(USAGE);
  process.exit(1);
}

// Fetch latest tags from remote
await $`git fetch --tags`.quiet();

// Read latest version from git tags (source of truth)
let current: string;
try {
  const result = await $`git describe --tags --abbrev=0`.text();
  current = result.trim().replace(/^v/, "");
} catch {
  current = "0.0.0";
}

// Calculate next version
const [major, minor, patch] = current.replace(/-.*$/, "").split(".").map(Number);
let next: string;
switch (type) {
  case "major":
    next = `${major + 1}.0.0`;
    break;
  case "minor":
    next = `${major}.${minor + 1}.0`;
    break;
  case "patch":
    next = `${major}.${minor}.${patch + 1}`;
    break;
  default:
    next = "";
}

const tag = `v${next}`;

// Duplicate tag protection
try {
  await $`git rev-parse ${tag}`.quiet();
  console.error(`Error: tag ${tag} already exists`);
  process.exit(1);
} catch {
  // Tag doesn't exist — safe to proceed
}

// Create and push tag
await $`git tag ${tag}`;
await $`git push origin ${tag}`;
// eslint-disable-next-line no-console
console.log(`Released ${tag}`);

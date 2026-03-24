# BetterPrompt CLI

BetterPrompt CLI helps you discover skills, install them, generate outputs, and manage local CLI state.

- Binary names: `betterprompt` and `bp`
- Package: `betterprompt`

## Installation

### From npm

```bash
npm install -g betterprompt
```

### From binary release (macOS / Linux, no Node.js required)

```bash
curl -fsSL https://raw.githubusercontent.com/BetterPromptme/betterprompt/main/install.sh | bash
```

### Verify install

```bash
betterprompt --version
betterprompt --help

# or

bp --version
bp --help
```

## Quick Start

1. Authenticate:

```bash
betterprompt login
```

2. Discover a skill:

```bash
betterprompt search "seo blog"
# or
betterprompt skill search "seo blog"
```

3. Inspect and install:

```bash
betterprompt skill info seo-blog-writer
betterprompt skill install seo-blog-writer --project
```

4. Generate output using the installed skill:

```bash
betterprompt generate seo-blog-writer \
  --input topic="best ai prompt tools" \
  --input audience="marketers"
```

5. Review outputs:

```bash
betterprompt outputs list --limit 20
```

## Global Flags

These are available on the root command and inherited by subcommands.

| Flag               | Description                       |
| ------------------ | --------------------------------- |
| `--project`        | Use project scope                 |
| `--global`         | Use global scope                  |
| `--dir <path>`     | Use an explicit working directory |
| `--registry <url>` | Override API registry endpoint    |
| `--json`           | Output in JSON format             |
| `--quiet`          | Reduce non-essential output       |
| `--verbose`        | Enable verbose output             |
| `--no-color`       | Disable ANSI colors               |
| `--yes`            | Answer yes to all confirmations   |
| `-h, --help`       | Show help                         |
| `-V, --version`    | Show CLI version                  |

## Commands

### Auth and Account

```bash
betterprompt login
betterprompt whoami [--json]
betterprompt credits [--json]
```

- `betterprompt login` opens a browser-based callback flow to authenticate.
- Get an API key at: https://betterprompt.me/api-keys

### Skill Discovery and Management

#### Search

```bash
betterprompt search <query> [--type <image|video|text>] [--author <author>] [--json]
betterprompt skill search <query> [--type <image|video|text>] [--author <author>] [--json]
```

`betterprompt search` is a top-level alias for `betterprompt skill search`.

#### Info

```bash
betterprompt skill info <skill-slug> [--json]
```

#### Install

```bash
betterprompt skill install <skill-slug> [--overwrite] [--json]
```

#### Uninstall

```bash
betterprompt skill uninstall <skill-slug> [--json]
```

#### List

```bash
betterprompt skill list [--json]
```

#### Update

```bash
betterprompt skill update [skill-slug] [--force] [--all] [--json]
```

- Provide a skill slug to update a single skill, or pass `--all` to update all installed skills in scope.
- `--force` re-installs even if already at latest version.

Examples:

```bash
betterprompt skill search "product photos" --type image
betterprompt skill info seo-blog-writer
betterprompt skill install seo-blog-writer --project
betterprompt skill list --project
betterprompt skill update --all --project
betterprompt skill update seo-blog-writer --force
```

### Generate

Generate output from an installed skill.

```bash
betterprompt generate <skill-slug> \
  [--input <key=value>]... \
  [--image-input-url <url>]... \
  [--image-input-base64 <base64>]... \
  [--input-payload <json>] \
  [--stdin] \
  [--model <model>] \
  [--options <json>] \
  [--json]
```

| Flag                            | Description                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--input <key=value>`           | Pass an input key/value pair (repeatable)                                                              |
| `--image-input-url <url>`       | Pass an image input URL (repeatable)                                                                   |
| `--image-input-base64 <base64>` | Pass a base64 image input (repeatable)                                                                 |
| `--input-payload <json>`        | JSON object shaped like `TRunInputs` (mutually exclusive with `--input`, `--image-input-*`, `--stdin`) |
| `--stdin`                       | Read input payload from stdin                                                                          |
| `--model <model>`               | Override generation model                                                                              |
| `--options <json>`              | JSON object of run options (maps to `runOptions` payload field)                                        |
| `--json`                        | Output in JSON format                                                                                  |

Input precedence: `--input` / image flags > `--stdin` > prompt defaults. Or use `--input-payload` as the single inputs source.

Examples:

```bash
betterprompt generate skill-version-123 \
  --input topic="best ai prompt tools" \
  --input audience="marketers"

betterprompt generate skill-version-123 \
  --image-input-url "https://example.com/reference.png" \
  --options '{"reasoningEffort":"high"}'

betterprompt generate skill-version-123 \
  --input-payload '{"textInputs":{"topic":"ai"}}'

cat input.json | betterprompt generate skill-version-123 --stdin --json
```

### Outputs

#### Fetch outputs from a run

```bash
betterprompt outputs <run-id> [--sync] [--remote] [--json]
```

| Flag       | Description                       |
| ---------- | --------------------------------- |
| `--sync`   | Wait for completion when possible |
| `--remote` | Use remote API endpoint           |
| `--json`   | Output in JSON format             |

#### List recent runs

```bash
betterprompt outputs list [--remote] [--status <status>] [--limit <n>] [--since <date>] [--json]
```

| Flag                | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `--remote`          | Use remote API endpoint                                       |
| `--status <status>` | Filter by status (`queued`, `running`, `succeeded`, `failed`) |
| `--limit <n>`       | Limit the number of rows                                      |
| `--since <date>`    | Filter by date (ISO 8601 or unix timestamp in ms)             |
| `--json`            | Output in JSON format                                         |

Examples:

```bash
betterprompt outputs list --limit 20
betterprompt outputs list --since 2026-02-01 --remote
betterprompt outputs output_abc123 --sync
betterprompt outputs output_abc123 --remote
```

### Resources

Show available models and run options. Results are cached locally and auto-synced when the server signals an update.

```bash
betterprompt resources [--remote] [--sync] [--models-only] [--json]
```

| Flag            | Description                                    |
| --------------- | ---------------------------------------------- |
| `--remote`      | Fetch from remote without updating local cache |
| `--sync`        | Fetch from remote and save to local cache      |
| `--models-only` | Output only the models list                    |
| `--json`        | Output in JSON format                          |

`--remote` and `--sync` are mutually exclusive.

Examples:

```bash
betterprompt resources                  # read from local cache (fetches on first run)
betterprompt resources --models-only    # list available models only
betterprompt resources --sync           # fetch from remote and update local cache
betterprompt resources --remote         # fetch from remote, do not update local cache
betterprompt resources --json
```

### Config

Read and update BetterPrompt config values. Supported keys: `apiKey`, `apiBaseUrl`.

```bash
betterprompt config get [key] [--json]
betterprompt config set <key> <value>
betterprompt config unset <key>
```

Examples:

```bash
betterprompt config get
betterprompt config get apiBaseUrl --json
betterprompt config set apiKey bp_live_123
betterprompt config unset apiKey
```

### Diagnostics

```bash
betterprompt doctor [--fix] [--json]
```

Checks auth state, registry reachability, install directories, and write permissions. Use `--fix` to attempt automatic remediation.

### CLI Lifecycle

```bash
betterprompt update [--json]
betterprompt reset [--yes] [--json]
```

- `betterprompt update` checks for CLI updates and installs when available.
- `betterprompt reset` removes the `~/.betterprompt` directory (config, auth, skills, outputs, logs). Prompts for confirmation unless `--yes` is passed.

## Directory Layout

See [`specs/DIRECTORY-LAYOUT.md`](specs/DIRECTORY-LAYOUT.md) for the full specification.

### Global state (`~/.betterprompt/`)

```text
~/.betterprompt/
├── config.json
├── auth.json
├── resources.json
├── outputs/
│   ├── history.jsonl
│   └── <runId>/
│       ├── request.json
│       ├── response.json
│       ├── metadata.json
│       └── assets/
├── skills/
│   └── <skill-slug>/
│       ├── SKILL.md
│       ├── manifest.json
│       └── schema.json
├── logs/
│   ├── cli.log
│   ├── auth.log
│   └── errors.log
└── tmp/
```

### Project-local state

Using `--project` initializes project-local files and folders:

```text
<project-root>/
├── betterprompt.json
└── .betterprompt/
    ├── skills/
    ├── outputs/
    ├── logs/
    └── tmp/
```

Project-local state overrides global state when both exist.

## Notes

- `betterprompt search` is an alias for `betterprompt skill search`.
- `--project`, `--global`, and `--dir` control installation and working scope.
- Use `--json` for machine-readable output in scripts and CI.

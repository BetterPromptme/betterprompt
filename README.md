# BetterPrompt CLI

BetterPrompt CLI helps you discover skills, install them, generate outputs, and manage local CLI state.

- Binary names: `betterprompt` and `bp`
- Package: `betterprompt`

## Installation

### From npm

```bash
npm install -g betterprompt
```

### Verify install

```bash
bp --version
bp --help
```

### Local development

```bash
bun install
bun run build
bun src/cli.ts --help
```

## Quick Start

1. Configure authentication:

```bash
bp auth
# or
bp auth --api-key bp_sk_abc123
```

2. Discover a skill:

```bash
bp skill search "seo blog"
# alias
bp search "seo blog"
```

3. Inspect and install:

```bash
bp skill info seo-blog-writer
bp skill install seo-blog-writer --project --pin
```

4. Generate output:

```bash
bp generate seo-blog-writer \
  --input topic="best ai prompt tools" \
  --input audience="marketers"
```

5. Review outputs:

```bash
bp outputs list --limit 20
```

## Global Flags

These are available on the root command and inherited by subcommands.

- `--project`: use project scope
- `--global`: use global scope
- `--dir <path>`: use an explicit working directory
- `--registry <url>`: override API registry endpoint
- `--json`: render output as JSON
- `--quiet`: reduce non-essential output
- `--verbose`: enable verbose output
- `--no-color`: disable ANSI colors
- `--yes`: answer yes to confirmations
- `-h, --help`: show help
- `-V, --version`: show CLI version

## Commands

### Auth and Account

```bash
bp auth [--api-key <key>]
bp whoami [--json]
bp credits [--json]
```

Examples:

```bash
bp auth
bp whoami
bp credits --json
```

### Skill Discovery and Management

```bash
bp search <query> [--type <image|video|text>] [--author <author>] [--json]
bp skill search <query> [--type <image|video|text>] [--author <author>] [--json]
bp skill info <skill-slug> [--json]
bp skill install <skill-slug> [--version <version>] [--pin] [--overwrite] [--json]
bp skill uninstall <skill-slug> [--json]
bp skill list [--json]
bp skill update [skill-slug] [--version <version>] [--force] [--all] [--json]
```

Examples:

```bash
bp skill search "product photos" --type image
bp skill info seo-blog-writer
bp skill install seo-blog-writer --project --pin
bp skill list --project
bp skill update --all --project
```

### Generate

```bash
bp generate <skill-slug> \
  [--input <key=value>]... \
  [--stdin] \
  [--interactive] \
  [--model <model>] \
  [--save-run] \
  [--json]
```

Examples:

```bash
bp generate seo-blog-writer --input topic="ai prompts"
cat input.json | bp generate internal-sales-reply --stdin --json
```

### Outputs

```bash
bp outputs <run-id> [--out <path>] [--json]
bp outputs list [--skill <skill-slug>] [--status <queued|running|succeeded|failed>] [--limit <n>] [--since <date>] [--json]
```

Examples:

```bash
bp outputs output_abc123 --out ./downloads
bp outputs list --skill seo-blog-writer --since 2026-02-01 --limit 10
```

### Config and Diagnostics

```bash
bp config get [key] [--json]
bp config set <key> <value>
bp config unset <key>
bp doctor [--fix] [--json]
```

Supported config keys:

- `apiKey`
- `apiBaseUrl`
- `default_output_format`
- `cache_ttl_seconds`
- `telemetry`
- `skills_dir`

Examples:

```bash
bp config get
bp config get apiBaseUrl
bp config set telemetry false
bp config unset skills_dir
bp doctor --fix
```

### CLI Lifecycle

```bash
bp update [--json]
bp uninstall [--yes] [--json]
```

Examples:

```bash
bp update
bp uninstall --yes
```

## Directory Layout

### Global state (`~/.betterprompt/`)

```text
~/.betterprompt/
├── config.json
├── auth.json
├── skills/
├── outputs/
├── logs/
└── tmp/
```

- `config.json`: global CLI config (registry and other defaults)
- `auth.json`: auth state for CLI API access
- `skills/`: globally installed skills
- `outputs/`: run outputs and local history artifacts
- `logs/`: CLI logs (`cli.log`, `auth.log`, `errors.log`)
- `tmp/`: temporary files

### Project-local state

Using `--project` initializes project-local files and folders:

```text
<project-root>/
├── betterprompt.json
├── betterprompt.lock
└── .betterprompt/
    ├── skills/
    ├── outputs/
    └── cache/
```

- `betterprompt.json`: project metadata/config
- `betterprompt.lock`: pinned versions and lock data
- `.betterprompt/`: project-scoped skill/output/cache state

## Notes

- `bp search` is an alias for `bp skill search`.
- `--project`, `--global`, and `--dir` control installation and working scope.
- Use `--json` for machine-readable output in scripts and CI.

# BetterPrompt CLI v1 Command Spec

This canvas captures the proposed **exact command syntax (including flags)** for the BetterPrompt CLI.

- Binary: `betterprompt`
- Alias: `bp`
- Primary goals:
  - search prompts
  - inspect prompt metadata
  - install prompts as skills
  - generate outputs from prompts
  - support private prompts safely

Prompt slugs follow the format `skill-slug` (e.g. `seo-blog-writer`).

---

## 1) Top-level shape

```bash
bp [global flags] <command> [subcommand] [args] [command flags]
```

## 2) Global flags

These should work on nearly every command:

```bash
--project               # force project-local scope
--global                # force global scope
--dir <path>            # override install/work directory
--json                  # machine-readable output
--quiet                 # suppress non-essential output
--verbose               # extra debug output
--no-color              # plain terminal output
--yes                   # skip prompts / assume yes
--help                  # help
-v, --version           # CLI version
```

Note: `--registry <url>` is a command-specific flag on `bp update`, not a global flag.

---

## 3) Command groups

## Auth

### Authenticate

```bash
bp auth [--api-key <key>]
```

Examples:

```bash
bp auth
bp auth --api-key bp_sk_abc123
```

Notes:

- `bp auth` with no arguments prompts interactively for an API key
- `--api-key` allows non-interactive setup (CI, scripts)

### Browser login

```bash
bp login
```

Examples:

```bash
bp login
```

Notes:

- Opens the browser to `https://betterprompt.me/api-keys` with a callback URL
- Starts a local HTTP callback server on port 22450–22460
- Receives the API key via localhost callback and saves credentials
- Always displays the login URL in the terminal (works even if browser fails to open)
- Ctrl-C cancels cleanly — the login command pauses the global SIGINT handler before registering its own, and resumes it after cleanup (see `src/services/error-ux/handle.ts` for the singleton). Exit code on cancel is `130` (POSIX standard).
- Uses `@clack/prompts` for interactive UI (spinner, intro/outro, note)

### Current identity

```bash
bp whoami [--json]
```

### Credits / balance

```bash
bp credits [--json]
```

---

## Skills

Skills are the primary way to discover, install, and manage prompts.

### Search for skills

```bash
bp skill search <query> \
  [--type image|video|text] \
  [--author <username>] \
  [--json]
```

`bp search` is a top-level alias for `bp skill search`.

Examples:

```bash
bp skill search "linkedin hook writer"
bp search "product photos" --type image
bp skill search "internal sales email" --author alice
```

### Show skill details

```bash
bp skill info <skill-slug> \
  [--json]
```

Examples:

```bash
bp skill info seo-blog-writer
bp skill info seo-blog-writer --json
```

### Install a skill

```bash
bp skill install <skill-slug> \
  [--agent <name> ...] \
  [--overwrite] \
  [--project | --global] \
  [--dir <path>] \
  [--json]
```

Examples:

```bash
bp skill install seo-blog-writer --agent claude
bp skill install product-shot-generator --agent claude --agent cursor
bp skill install seo-blog-writer --agent claude --overwrite
```

Behavior:

- Caches manifest + schema + SKILL.md in `.betterprompt/skills/<slug>/`
- `--agent` copies `SKILL.md` to `~/.<agent>/skills/<slug>/SKILL.md` (repeatable)
- Tracks installed agents in `manifest.json` (`installedAgents` array)
- Supported agents: `agents`, `openclaw`, `cursor`, `claude`, `windsurf`, `antigravity`
- Does **not** install private protected prompt text

### Uninstall a skill

```bash
bp skill uninstall <skill-slug> \
  --agent <name> | --agent "*" \
  [--project | --global] \
  [--json]
```

Examples:

```bash
bp skill uninstall seo-blog-writer --agent claude
bp skill uninstall product-shot-generator --agent "*"
```

Behavior:

- `--agent` is required — removes SKILL.md from the specified agent directory
- `--agent "*"` removes from all agents tracked in `installedAgents`
- Cache in `.betterprompt/skills/<slug>/` is always kept

### List installed skills

```bash
bp skill list \
  [--project | --global] \
  [--json]
```

Examples:

```bash
bp skill list
bp skill list --project
```

Text output shows a table with `Slug` and `Installed Agents` columns. JSON output includes `installedAgents` array per skill.

### Update installed skills

```bash
bp skill update [<skill-slug>] \
  [--project | --global] \
  [--all] \
  [--force] \
  [--json]
```

Examples:

```bash
bp skill update seo-blog-writer
bp skill update --all --project
```

---

## Generate

This is the core command for running prompts and producing outputs.

### Generate output from a prompt

```bash
bp generate <skill-slug> \
  [--input <key=value> ...] \
  [--input-payload <json>] \
  [--image-input-url <url> ...] \
  [--image-input-path <path> ...] \
  [--stdin] \
  [--model <model>] \
  [--options <json>] \
  [--json]
```

Examples:

```bash
bp generate seo-blog-writer \
  --input-payload '{"textInputs":{"topic":"best ai prompt tools"}}' \
  --input topic="best ai prompt tools" \
  --input audience="marketers" \
  --input tone="clear" \
  --image-input-url "https://example.com/reference.png" \
  --image-input-path "/path/to/image.jpg" \
  --options '{"reasoningEffort":"high","quality":"hd"}'

cat input.json | bp generate seo-blog-writer --stdin --json
```

Notes:

- `<skill-slug>` is required for `generate`. The skill must be installed locally.
- Internally, the CLI resolves the slug to a `promptVersionId` from the installed skill's manifest and sends it to the API.
- `--options <json>` accepts a JSON object and maps to the `runOptions` payload field.
- `--input-payload <json>` accepts a JSON object shaped like `TRunInputs` and maps to `inputs`.
- `--input-payload` is mutually exclusive with `--input`, `--image-input-url`, `--image-input-path`, and `--stdin`.
- `--stdin` reads a JSON object shaped like `TRunInputs` from standard input.
- `--image-input-url <url>` appends `{ "type": "url", "url": "<url>" }` to `inputs.imageInputs`.
- `--image-input-path <path>` reads the local image file, compresses it (max 2048px edge, JPEG 80%), and appends the result as `{ "type": "base64", "base64": "<data-uri>" }` to `inputs.imageInputs`.

### Input precedence

Standardize precedence as:

1. `--input` / image flags
2. `--stdin`
3. prompt defaults

Or use only `--input-payload` as the single inputs source.

### Output behavior

Output is always a structured JSON object (`TRunResult`). The `outputs` array contains `TPart` entries, each with a numeric `type` (`PART_TYPE` enum) and a string `data`:

| `type` | `PART_TYPE` | `data` contains               |
| ------ | ----------- | ----------------------------- |
| `0`    | `TEXT`      | Markdown-formatted text       |
| `1`    | `IMAGE`     | S3 key of the generated image |
| `2`    | `ERROR`     | Error message                 |
| `3`    | `VIDEO`     | S3 key of the generated video |

`TTextPart` also has an optional `thoughtSignature` field.

Default display (no `--json`): pretty-print the text content or asset key to stdout.

`--json` returns the raw structured JSON.

Text output example:

```json
{
  "runId": "run_123",
  "runStatus": "succeeded",
  "outputs": [
    {
      "type": 0,
      "data": "# Best AI Prompt Tools\n\nHere are the top tools..."
    }
  ]
}
```

Image output example:

```json
{
  "runId": "run_456",
  "runStatus": "succeeded",
  "outputs": [
    {
      "type": 1,
      "data": "outputs/run_456/image.png"
    }
  ]
}
```

---

## Outputs

### Fetch outputs from a run

```bash
bp outputs <run-id> \
  [--sync] \
  [--remote] \
  [--json]
```

### List recent runs

```bash
bp outputs list \
  [--remote] \
  [--status queued|running|succeeded|failed] \
  [--limit <n>] \
  [--since <date>] \
  [--json]
```

### `bp outputs <run-id>` flag details

| Flag       | Type    | Default | Behavior                                                      |
| ---------- | ------- | ------- | ------------------------------------------------------------- |
| `--sync`   | boolean | `false` | Fetch outputs from remote and update local artifacts/state.   |
| `--remote` | boolean | `false` | Use remote outputs scope.                                     |
| `--json`   | boolean | `false` | Print machine-readable JSON instead of human-friendly output. |

### `bp outputs list` flag details

| Flag                                               | Type        | Default | Behavior                                                      |
| -------------------------------------------------- | ----------- | ------- | ------------------------------------------------------------- |
| `--remote`                                         | boolean     | `false` | List runs from remote outputs scope.                          |
| `--status <queued / running / succeeded / failed>` | enum        | none    | Filter listed runs by run status.                             |
| `--limit <n>`                                      | number      | none    | Limit the number of returned runs.                            |
| `--since <date>`                                   | string/date | none    | Show runs created on or after the given date.                 |
| `--json`                                           | boolean     | `false` | Print machine-readable JSON instead of human-friendly output. |

Examples:

```bash
bp outputs list --limit 20
bp outputs list --since 2026-02-01
bp outputs output_abc123 --sync
bp outputs output_abc123 --remote
```

---

## Resources

Displays available models and run options. Results are cached locally at `~/.betterprompt/resources.json` and automatically kept in sync when the server signals an update via the `action-require: update-resources` response header.

### Show available resources

```bash
bp resources \
  [--remote] \
  [--sync] \
  [--models-only] \
  [--json]
```

| Flag            | Type    | Default | Behavior                                                      |
| --------------- | ------- | ------- | ------------------------------------------------------------- |
| `--remote`      | boolean | `false` | Fetch from remote without updating the local cache.           |
| `--sync`        | boolean | `false` | Fetch from remote and save to local cache.                    |
| `--models-only` | boolean | `false` | Output only the models list (omit other resource sections).   |
| `--json`        | boolean | `false` | Print machine-readable JSON instead of human-friendly output. |

Examples:

```bash
bp resources                  # read from local cache (fetches and caches on first run)
bp resources --models-only    # list available models only
bp resources --sync           # fetch from remote and update local cache
bp resources --remote         # fetch from remote, do not update local cache
bp resources --json           # output as JSON
```

Notes:

- On first run (no local cache), resources are fetched from remote and saved automatically.
- When any API response includes `action-require: update-resources`, the CLI silently re-syncs resources in the background.
- Both `--remote` and `--sync` skip attaching the `cli-agent` header (which carries the resources hash), so neither call triggers a re-sync loop.

---

## CLI management

### Update the CLI

```bash
bp update [--json]
```

### Reset CLI local data

```bash
bp reset [--yes] [--json]
```

Removes the `~/.betterprompt` directory (config, auth, skills, outputs, logs). Prompts for confirmation unless `--yes` is passed.

---

## Config and diagnostics

### Config

```bash
bp config get [<key>] [--json]
bp config set <key> <value>
bp config unset <key>
```

Examples:

```bash
bp config get
bp config get default_org --json
bp config set default_org acme
bp config set skills_dir ~/.betterprompt/skills
bp config unset skills_dir
```

### Doctor

```bash
bp doctor [--json] [--fix]
```

Checks:

- auth state
- registry reachability
- install dirs
- write permissions

---

## 4) Naming decisions to lock now

### Use `skill` as the namespace for prompt management

All prompt discovery and management commands live under `bp skill`:

- `skill search`
- `skill info`
- `skill install`
- `skill uninstall`
- `skill list`
- `skill update`

`bp search` is a top-level alias for `bp skill search` for convenience.

### Use `skill-slug` format for prompt identifiers

All prompt references use the `skill-slug` format (e.g. `seo-blog-writer`). This makes authorship unambiguous and avoids slug collisions.

### Use `generate`, not `run` or `execute`

`generate` makes the value proposition clear: you're producing an output, not executing code. It also avoids confusion with `npm run`, `docker run`, etc.

### Use `auth` for API key setup, `login` for browser auth

`bp auth` accepts an API key directly (interactive prompt or `--api-key` flag). `bp login` opens the browser for OAuth-style authentication via the BetterPrompt web app. Both save credentials to `auth.json`.

### Use `outputs`, not `history`

Keeps the focus on what users care about: retrieving their generated content, not browsing a log.

### `bp update` is for the CLI itself, `bp reset` clears local data

`bp update` manages the BetterPrompt CLI package, not skills. Skill management uses `bp skill update` and `bp skill uninstall`. `bp reset` removes the `~/.betterprompt` directory to clear all local data.

---

## 5) Recommended flag conventions

### Scope flags

```bash
--project
--global
--dir <path>
```

### Non-interactive automation flags

```bash
--json
--yes
--quiet
```

### Input flags

```bash
--input <key=value>       # repeatable
--stdin
```

### Output flags

```bash
--sync
--remote
```

---

## 6) Example end-to-end flows

### Find and install a skill

```bash
bp skill search "linkedin carousel"
bp skill info linkedin-carousel-writer
bp skill install linkedin-carousel-writer --agent claude
```

### Generate with a private prompt

```bash
bp auth
bp skill install internal-sales-reply --agent claude --agent cursor
bp generate internal-sales-reply \
  --input customer_name="Jane" \
  --input context="asked about enterprise pricing" \
  --json
```

### Review past outputs

```bash
bp outputs list --limit 10
bp outputs output_abc123 --sync
```

### Check system health

```bash
bp whoami
bp credits
bp doctor
```

---

## 7) What to avoid in v1

Avoid adding these too early:

- `bp publish`
- `bp workflow ...`
- `bp install <url>`
- `bp run` (use `generate`)
- `bp preset ...`
- `bp init` / `bp sync` / `bp validate`
- `bp cleanup`
- `bp skill export` / `bp skill rebuild`
- `--profile` (multi-profile support)
- `--org` (org/workspace scoping)
- `bp auth login` / `bp auth logout` (subcommands under auth; browser login is handled by `bp login`)

Keep v1 focused on:

- discover (`skill search`, `skill info`)
- install (`skill install`)
- generate
- manage (`skill list`, `skill update`, `skill uninstall`)

---

## 8) Recommended minimal v1 command set

```bash
bp auth
bp login
bp whoami
bp credits              # get current credit balance
bp update               # update the CLI itself
bp reset                # reset CLI local data (~/.betterprompt)
bp skill search         # alias: `bp search`
bp skill install
bp skill uninstall
bp skill list           # list installed skills
bp skill update
bp skill info
bp generate
bp outputs
bp outputs list
bp resources            # list available models and run options
bp config               # set / get / unset
bp doctor
```

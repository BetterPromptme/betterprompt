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
--registry <url>        # override API/registry endpoint
--json                  # machine-readable output
--quiet                 # suppress non-essential output
--verbose               # extra debug output
--no-color              # plain terminal output
--yes                   # skip prompts / assume yes
--help                  # help
-v, --version           # CLI version
```

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
  [--overwrite] \
  [--project | --global] \
  [--dir <path>] \
  [--json]
```

Examples:

```bash
bp skill install seo-blog-writer --project
bp skill install product-shot-generator --global
```

Behavior:

- installs manifest + schema + metadata + skill wrapper
- does **not** install private protected prompt text
- the installed folder uses the `skill-slug` portion only (e.g. `seo-blog-writer` installs to `seo-blog-writer/`). If a different author has the same prompt slug, the later install overwrites.

### Uninstall a skill

```bash
bp skill uninstall <skill-slug> \
  [--project | --global] \
  [--json]
```

Examples:

```bash
bp skill uninstall seo-blog-writer --project
bp skill uninstall product-shot-generator --global
```

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
bp generate <skillVersionId> \
  [--input <key=value> ...] \
  [--input-payload <json>] \
  [--image-input-url <url> ...] \
  [--image-input-base64 <base64> ...] \
  [--stdin] \
  [--model <model>] \
  [--run-option <json>] \
  [--json]
```

Examples:

```bash
bp generate skill-version-123 \
  --input-payload '{"textInputs":{"topic":"best ai prompt tools"}}' \
  --input topic="best ai prompt tools" \
  --input audience="marketers" \
  --input tone="clear" \
  --image-input-url "https://example.com/reference.png" \
  --image-input-base64 "<base64-image-data>" \
  --run-option '{"reasoningEffort":"high","quality":"hd"}'

cat input.json | bp generate skill-version-123 --stdin --json
```

Notes:

- `<skillVersionId>` is required for `generate`.
- Internally, `createRun` still sends this value using the payload key `promptVersionId`.
- `--run-option <json>` accepts a JSON object and maps to the `runOptions` payload field.
- `--input-payload <json>` accepts a JSON object shaped like `TRunInputs` and maps to `inputs`.
- `--input-payload` is mutually exclusive with `--input`, `--image-input-url`, `--image-input-base64`, and `--stdin`.
- `--stdin` reads a JSON object shaped like `TRunInputs` from standard input.
- `--image-input-url <url>` appends `{ "type": "url", "url": "<url>" }` to `inputs.imageInputs`.
- `--image-input-base64 <base64>` appends `{ "type": "base64", "base64": "<base64>" }` to `inputs.imageInputs`.

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

## CLI management

### Update the CLI

```bash
bp update [--json]
```

### Uninstall the CLI

```bash
bp uninstall [--yes] [--json]
```

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

### Use `auth` for API key setup

`bp auth` is the single entry point for authentication via API key. No subcommands, orgs, or profiles in v1.

### Use `outputs`, not `history`

Keeps the focus on what users care about: retrieving their generated content, not browsing a log.

### `bp update` and `bp uninstall` are for the CLI itself

These top-level commands manage the BetterPrompt CLI package, not skills. Skill management uses `bp skill update` and `bp skill uninstall`.

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
bp skill install linkedin-carousel-writer --project
```

### Generate with a private prompt

```bash
bp auth
bp skill install internal-sales-reply --project
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
- `bp auth login` / `bp auth logout` (subcommands, browser/device flows)

Keep v1 focused on:

- discover (`skill search`, `skill info`)
- install (`skill install`)
- generate
- manage (`skill list`, `skill update`, `skill uninstall`)

---

## 8) Recommended minimal v1 command set

```bash
bp auth
bp whoami
bp credits              # get current credit balance
bp update               # update the CLI itself
bp uninstall            # uninstall the CLI itself
bp skill search         # alias: `bp search`
bp skill install
bp skill uninstall
bp skill list           # list installed skills
bp skill update
bp skill info
bp generate
bp outputs
bp outputs list
bp config               # set / get / unset
bp doctor
```

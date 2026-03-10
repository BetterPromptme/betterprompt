---
name: betterprompt
description: Discover, install, and run reusable AI prompt skills from the BetterPrompt registry via the CLI (betterprompt / bp). Use when a user needs to find a prompt skill, generate AI output (text, images, video), or manage their skill library. Covers installation, auth, skill discovery, generation, and output review for OpenClaw and Claude Code agents.
---

# BetterPrompt CLI

BetterPrompt CLI (`betterprompt` / `bp`) lets you discover, install, and run reusable AI prompt skills from the registry at betterprompt.me. Skills are versioned prompts that generate text, image, or video outputs. Both binary names work interchangeably; prefer `betterprompt` over `bp`.

## Installation

```sh
npm install -g betterprompt
# or
bun install -g betterprompt
# or
yarn global add betterprompt
# or
pnpm add -g betterprompt
```

Verify installation:

```sh
betterprompt --version
betterprompt --help
```

## Configuration

Authenticate with your API key from https://betterprompt.me/api-keys:

```sh
# Interactive (prompts for key)
betterprompt auth

# Non-interactive
betterprompt auth --api-key <key>
```

Manage settings:

```sh
betterprompt config get           # show all config
betterprompt config set <key> <value>
```

Diagnostics and identity:

```sh
betterprompt doctor               # check setup
betterprompt doctor --fix         # auto-fix issues
betterprompt whoami               # show current user
betterprompt credits              # show credit balance
```

## Skill Discovery

Search the registry:

```sh
betterprompt skill search "<query>"                      # full-text search
betterprompt skill search "<query>" --type text          # filter by output type: text | image | video
betterprompt skill search "<query>" --author <name>      # filter by author
betterprompt skill search "<query>" --json               # machine-readable JSON output
```

Inspect a skill before installing:

```sh
betterprompt skill info <skill-slug>                     # show details, inputs, output type
betterprompt skill info <skill-slug> --json
```

## Output Generation

Run a skill to generate output:

```sh
betterprompt generate <skillVersionId> [input flags] [--model <model>] [--options <json>] [--json]
```

Input methods (use the one that matches the skill's input contract):

```sh
# Key-value pairs (repeatable)
betterprompt generate <skillVersionId> --input key=value --input key2=value2

# Image via URL
betterprompt generate <skillVersionId> --image-input-url <url>

# Image via base64
betterprompt generate <skillVersionId> --image-input-base64 <base64string>

# JSON payload (all inputs as a single JSON object)
betterprompt generate <skillVersionId> --input-payload '{"key": "value"}'

# Stdin pipe
echo "input text" | betterprompt generate <skillVersionId> --stdin
```

Flags:

```sh
--model <model>       override the default model for this skill
--options <json>      pass provider-specific model options as JSON
--json                output structured JSON (includes run-id, status, outputs)
```

The `--json` response includes a `runId` field used to retrieve outputs later.

## Output Review

Retrieve outputs for a specific run:

```sh
betterprompt outputs <run-id>             # fetch outputs (returns immediately if ready)
betterprompt outputs <run-id> --sync      # wait for completion, then return
betterprompt outputs <run-id> --remote    # force fetch from remote (bypass local cache)
```

List past outputs:

```sh
betterprompt outputs list                            # list recent outputs
betterprompt outputs list --limit <n>               # cap results (default: 20)
betterprompt outputs list --since <ISO-date>        # filter by date (e.g. 2025-01-01)
betterprompt outputs list --status <status>         # filter by status (pending|running|complete|error)
betterprompt outputs list --skill <slug>            # filter by skill slug
```

Output types:

| Type  | Value |
| ----- | ----- |
| TEXT  | 0     |
| IMAGE | 1     |
| ERROR | 2     |
| VIDEO | 3     |

## Skill Management

Install a skill:

```sh
betterprompt skill install <skill-slug>                  # install globally (default)
betterprompt skill install <skill-slug> --project        # install in current project
```

List installed skills:

```sh
betterprompt skill list                                  # list global skills
betterprompt skill list --project                        # list project skills
```

Update skills:

```sh
betterprompt skill update <skill-slug>                   # update one skill
betterprompt skill update --all                          # update all installed skills
```

Remove a skill:

```sh
betterprompt skill uninstall <skill-slug>
```

## Global Flags

These flags work on most commands:

```sh
--project       scope to the current project (vs global)
--global        scope to global install
--json          structured JSON output (machine-readable)
--quiet         suppress informational output
--verbose       show full debug/trace output
--yes           auto-confirm prompts
```

## OpenClaw Agent Integration

### Progress Messaging (REQUIRED)

For every BetterPrompt task, send progress updates to the **current chat** using the `message` tool.

Resolve destination from inbound metadata:

- `channel` = current provider/app (e.g. `discord`, `whatsapp`, `telegram`, `slack`)
- `target` = current chat id (e.g. `channel:...`, `chat:...`)

**Send/edit pattern:** Create one progress message at the start; edit that same message for each subsequent update. Do not send a new message per step.

1. Send initial progress message:
   - `action: "send"`, `channel: "<app>"`, `target: "<chat-id>"`
   - `message: "🚀 Starting your request: <task>. I'm kicking off the workflow now."`
2. Capture the returned `messageId`.
3. For each subsequent update: `action: "edit"` with the same `messageId`.

Required status messages (edit in sequence):

- Search start: `🔎 Starting search: Looking for the best matching skill now.`
- Search end: `🔎 Search complete: Found <N> relevant skill(s).`
- Skill info start: `📄 Loading skill details: Checking the selected skill now.`
- Skill info end: `📄 Skill details loaded: Ready to validate <skill name>.`
- Validation start: `🧪 Starting validation: Verifying inputs, model, and options.`
- Validation end: `✅ Validation complete: Inputs/models/options look valid.`
- Run start: `⚙️ Run started: Running the prompt now — this may take a moment.`
- Run end: `🖼️ Run complete: Output received successfully. Final result posted below.`

### Execution Pipeline

Run these steps in order and stop when the user's goal is satisfied:

1. **Search** — `betterprompt skill search "<task or capability>"`
2. **Inspect** — `betterprompt skill info <skill-slug>`
3. **Validate** from skillmd — confirm: Prompt Version ID, required inputs (`textInputs`, `imageInputs`), image count constraints, allowed `--model`, allowed `--options` values
4. **Execute** — `betterprompt generate <skillVersionId> [input flags]`

Do not skip step 2 or 3 before step 4. If step 2 fails due to transient error, retry once.

### Early-Return Flow

If the user only wants discovery (e.g. "search prompts", "show me skills"), stop after Search and return immediately.

Display rules for search-only results — each skill as **one message**:

- Number items (`1.`, `2.`, ...) with `<title>` + `<short description>` in the same message
- If sample output is an image URL → send as media with numbered caption
- If sample output is text → single text message with `> <sample text>` quote block
- If no sample output → include "No sample output available." in the item message
- Do not split one skill item across multiple messages

If a later step is blocked (missing input, API failure, user pause), return the best available result from completed steps without waiting for the full pipeline.

### Output Handling

After a successful run, return exactly:

1. **Exact result** — same content BetterPrompt returned, formatted for readability only
2. **One next step** — exactly one actionable suggestion

Fidelity rules:

- Text: light formatting only (line breaks, short intro); preserve all content verbatim
- Images: send the exact returned URL as media (Discord: use `message` tool with `media: <url>`); if multiple image URLs, send multiple media messages
- Never invent, summarize away, or alter output content
- Do not include skill IDs, prompt version IDs, raw JSON, or internal logs unless explicitly asked

### Skill Selection Rubric

When multiple skills match, prefer higher score on:

1. Intent match to user request
2. Input contract clarity in skillmd
3. Output predictability/repeatability
4. Fewer ambiguous runtime options

If tied, pick the skill with clearer skillmd run instructions.

### Failure and Timeout Handling

- Show key error directly; provide one corrective action
- Retry once if safe and likely to succeed
- If timeout returns a `runId`, report it and offer `betterprompt outputs <run-id> --sync` as follow-up
- If blocked by CLI version, upgrade CLI then rerun full pipeline

### Input Safety and CLI Correctness

- Match skillmd input constraints exactly
- Build JSON safely; never concatenate raw user text into shell JSON
- Use `jq -n` or temp JSON files for `--input-payload` / `--options`
- For image prompts: enforce required image count before running; prefer URLs over base64; avoid shell overflow with large base64 payloads
- Use only documented flags; check `betterprompt generate --help` when unsure about a flag
- Never invent parameters

## Claude Code Agent Integration

Run all `betterprompt` commands via the **Bash tool**. Use `--json` where possible for structured output.

### Discovery Workflow

```sh
betterprompt skill search "<user task>" --json        # find candidates
betterprompt skill info <skill-slug> --json           # inspect inputs, output type, skillVersionId
```

### Generation Workflow

1. Read `betterprompt skill info <skill-slug> --json` output to confirm: `skillVersionId`, required inputs, output type
2. Build the generate command from the skill's input contract:

```sh
betterprompt generate <skillVersionId> --input key=value --json
```

3. Capture `runId` from the JSON response for async output retrieval:

```sh
betterprompt outputs <run-id> --sync --json
```

### Review Workflow

```sh
betterprompt outputs <run-id> --json                  # fetch by run id
betterprompt outputs list --skill <slug> --json       # list past outputs for a skill
```

### Rules

- Always call `betterprompt skill info` before `betterprompt generate` — never guess `skillVersionId` or input names
- Use `--json` for all commands where structured parsing is needed
- For `--input-payload` or `--options`, build JSON via a variable or temp file; never concatenate raw user input into shell strings
- On error, retry once if the failure looks transient; otherwise surface the error message directly
- Do not generate output or retry more than once without confirming the user still wants to proceed

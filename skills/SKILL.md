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

```sh
# Binary release (macOS / Linux, no Node.js required)
curl -fsSL https://raw.githubusercontent.com/BetterPromptme/betterprompt/main/install.sh | bash
```

Verify installation:

```sh
betterprompt --version
betterprompt --help
```

## Configuration

Authenticate via browser:

```sh
betterprompt login
```

Manage settings:

```sh
betterprompt config get           # show all config
betterprompt config get <key>     # get a specific key (apiKey | apiBaseUrl)
betterprompt config set <key> <value>
betterprompt config unset <key>   # remove a config value
```

Diagnostics and identity:

```sh
betterprompt doctor [--fix] [--json]   # check setup; --fix to auto-fix issues
betterprompt whoami [--json]           # show current user
betterprompt credits [--json]          # show credit balance
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
betterprompt outputs get <run-id>         # same as above (explicit subcommand form)
```

List past outputs:

```sh
betterprompt outputs list                            # list recent outputs
betterprompt outputs list --limit <n>               # cap results (default: 20)
betterprompt outputs list --since <ISO-date>        # filter by date (ISO 8601 or unix timestamp in ms)
betterprompt outputs list --status <status>         # filter by status (queued|running|succeeded|failed)
betterprompt outputs list --remote                  # fetch list from remote API
```

Output types:

| Type  | Value   |
| ----- | ------- |
| TEXT  | "text"  |
| IMAGE | "image" |
| ERROR | "error" |
| VIDEO | "video" |

## Skill Management

Install a skill:

```sh
betterprompt skill install <skill-slug>                  # install globally (default)
betterprompt skill install <skill-slug> --project        # install in current project
betterprompt skill install <skill-slug> --overwrite      # overwrite an existing installed skill
```

List installed skills:

```sh
betterprompt skill list                                  # list global skills
betterprompt skill list --project                        # list project skills
```

Update skills:

```sh
betterprompt skill update <skill-slug>                   # update one skill
betterprompt skill update <skill-slug> --force           # re-install even if already at latest version
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
--dir <path>    use an explicit working directory
--registry <url> override API registry endpoint
--json          structured JSON output (machine-readable)
--quiet         reduce non-essential output
--verbose       enable verbose output
--no-color      disable ANSI colors
--yes           answer yes to all confirmations
-h, --help      show help for any command
-V, --version   show CLI version
```

## Top-Level Search

A convenience alias for `betterprompt skill search`:

```sh
betterprompt search "<query>"                            # full-text search
betterprompt search "<query>" --type text                # filter by output type: text | image | video
betterprompt search "<query>" --author <name>            # filter by author
betterprompt search "<query>" --json                     # machine-readable JSON output
```

## Resources

Show available models and resources:

```sh
betterprompt resources                                   # show available models and resources
betterprompt resources --models-only                     # output only the models list
betterprompt resources --remote                          # fetch from remote API
betterprompt resources --sync                            # sync resources locally
betterprompt resources --json                            # machine-readable JSON output
```

Note: `--remote` and `--sync` are mutually exclusive.

## CLI Maintenance

```sh
betterprompt update [--json]                             # check for CLI updates and install
betterprompt reset [--yes] [--json]                      # reset ~/.betterprompt directory (prompts for confirmation)
```

## OpenClaw Agent Integration

### Execution Pipeline

Run these steps in order and stop when the user's goal is satisfied:

1. **Search** — `betterprompt skill search "<task or capability>"`
2. **Inspect** — `betterprompt skill info <skill-slug>`
3. **Validate** from skillmd — confirm: Prompt Version ID, required inputs (`textInputs`, `imageInputs`), image count constraints, allowed `--model`, allowed `--options` values
4. **Execute** — `betterprompt generate <skillVersionId> [input flags]`

Do not skip step 2 or 3 before step 4. If step 2 fails due to transient error, retry once.

### Channel Display Rules

All content returned to users must render natively in their channel platform. Never send raw URLs, raw JSON, or unformatted dumps. The rules below apply to every content type the agent presents: search results, skill details, generation outputs, and resources.

If the user only wants discovery (e.g. "search prompts", "show me skills"), stop after Search and return immediately. If a later step is blocked (missing input, API failure, user pause), return the best available result from completed steps without waiting for the full pipeline.

#### Platform-Specific Image Rendering

Never send an image URL as plain text — always use the platform's native image mechanism so the image displays inline in the chat. The URL must be publicly accessible over HTTPS.

| Platform            | Method                              | Key Details                                                                          |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| **Discord**         | Embed with `image.url`              | Bare URLs may not unfurl reliably; always use embeds                                 |
| **Slack**           | Block Kit `image` block             | `image_url` + `alt_text` (required); URL unfurling depends on workspace settings     |
| **Telegram**        | `sendPhoto` Bot API method          | `sendMessage` with a URL does not render images; URL in `photo` param                |
| **Microsoft Teams** | Adaptive Card `Image` element       | `"type": "Image", "url": "…"`; bare URLs render as links, not images; HTTPS required |
| **WhatsApp**        | Messages API with `"type": "image"` | `image.link`; PNG/JPG only, max 5 MB, valid SSL + Content-Type headers required      |

- If the URL is behind auth or ephemeral, download the image first and upload it as a direct attachment
- If multiple image URLs are returned, send each as a separate image message

#### Platform-Specific Text & Rich Content

| Platform            | Formatting                                                | Lists / Tables                                                                      | Code Blocks                                |
| ------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| **Discord**         | Markdown (bold, italic, headers, links)                   | Numbered/bulleted lists; no native tables — use code block alignment                | ` ```lang ` fenced blocks                  |
| **Slack**           | mrkdwn (`*bold*`, `_italic_`, `<url\|text>`)              | Bulleted with `•`; numbered manually; no native tables — use Section blocks or code | ` ``` ` blocks (no language hint)          |
| **Telegram**        | MarkdownV2 or HTML (`<b>`, `<i>`, `<a>`, `<code>`)        | Manual numbered/bulleted; no native tables — use `<pre>` aligned columns            | `<pre>` or ` ``` `                         |
| **Microsoft Teams** | Subset of HTML + Adaptive Cards                           | Adaptive Card `FactSet` for key-value; `TextBlock` with markdown for lists          | `<pre><code>` or Adaptive Card `CodeBlock` |
| **WhatsApp**        | Limited: `*bold*`, `_italic_`, `~strike~`, ` ```mono``` ` | Manual numbered/bulleted only; no rich formatting for tables                        | ` ``` ` blocks (no language hint)          |

#### Search Results (item list)

Present each skill as **one message** — do not split a single skill across multiple messages:

- Number items (`1.`, `2.`, …) with `<title>` + `<short description>` in the same message
- If sample output is an image URL → render inline using platform image method (see table above) with numbered caption
- If sample output is text → quote block (`> <sample text>` or platform equivalent)
- If no sample output → include "No sample output available." in the item message

#### Skill Details (info)

When presenting skill info from `betterprompt skill info`:

- **Title + description** as a header or bold line
- **Required inputs** as a list: name, type, constraints (e.g. "imageInputs: 1–3 images")
- **Available models** as a compact comma-separated list or tag format
- **Sample output** rendered inline (image or quoted text per platform rules)
- Keep it to one message; use the platform's rich formatting (embeds, cards, blocks) to structure sections visually

#### Generation Output

After a successful run, return exactly:

1. **Exact result** — same content BetterPrompt returned, formatted for readability only
2. **One next step** — exactly one actionable suggestion

Fidelity rules:

- Text: light formatting only (line breaks, short intro); preserve all content verbatim
- Images: render inline per platform image rules above
- Never invent, summarize away, or alter output content
- Do not include skill IDs, prompt version IDs, raw JSON, or internal logs unless explicitly asked

#### Resources

When presenting results from `betterprompt resources`:

- **Models list**: formatted as a numbered list or compact table showing model name and provider
- **Resource details**: key-value pairs using the platform's native structured format (Discord embed fields, Slack `section` blocks, Teams `FactSet`, Telegram bold key + value)
- Keep it scannable — one message, no walls of text

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
betterprompt outputs list --json                      # list past outputs
```

### Rules

- Always call `betterprompt skill info` before `betterprompt generate` — never guess `skillVersionId` or input names
- Use `--json` for all commands where structured parsing is needed
- For `--input-payload` or `--options`, build JSON via a variable or temp file; never concatenate raw user input into shell strings
- On error, retry once if the failure looks transient; otherwise surface the error message directly
- Do not generate output or retry more than once without confirming the user still wants to proceed

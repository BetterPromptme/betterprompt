# `~/.betterprompt` Directory Layout

A clean v1 layout for `~/.betterprompt` that supports:

- auth
- installed skills
- output history
- logs

## Recommended layout

```text
~/.betterprompt/
├── config.json
├── auth.json
├── outputs/
│   ├── history.jsonl
│   ├── 01HXYZ.../
│   │   ├── request.json
│   │   ├── response.json
│   │   ├── metadata.json
│   │   └── assets/
├── skills/
│   ├── betterprompt-seo-blog/
│   │   ├── SKILL.md
│   │   ├── manifest.json
│   │   └── schema.json
│   └── image-ad-generator/
│   │   ├── SKILL.md
│   │   ├── manifest.json
│   │   └── schema.json
├── logs/
│   ├── cli.log
│   ├── auth.log
│   └── errors.log
└── tmp/
```

## What each file and folder is for

### `config.json`

Global CLI defaults:

- default registry
- default output format
- cache TTL
- telemetry opt-in/out

Example:

```json
{
  "default_registry": "https://api.betterprompt.me",
  "telemetry": false
}
```

### `auth.json`

Lightweight auth state.

Prefer:

- actual secrets/tokens stored in **OS keychain**
- this file stores session metadata, selected account, device-login state

That way you avoid plaintext tokens in dotfiles.

### `skills/<skill-slug>/`

One folder per installed skill.

Each skill folder contains:

- `SKILL.md` → human-readable skill description and usage
- `manifest.json` → identity, author, visibility, pricing, prompt id, version
- `schema.json` → input/output contract

For **private/protected** prompts, do **not** store full underlying prompt text here.

### `outputs/`

Stores local execution history and downloaded outputs.

Recommended split:

- `history.jsonl` → append-only index for fast CLI listing
- per-run subfolders (`<runId>/`) → full request/response snapshot + assets

This is useful for:

- reproducibility
- debugging failed outputs
- reopening outputs
- cost audit

Example output folder:

```text
outputs/01HXYZ.../
├── request.json
├── response.json
├── metadata.json
├── assets/
│   ├── hero.png
│   └── alt-1.png
```

### `logs/`

CLI operational logs only.
Do not mix with outputs.

- `cli.log` → normal operations
- `auth.log` → auth/debug issues
- `errors.log` → failures

### `tmp/`

Transient files only.
Safe to clear on startup or with `bp cleanup`.

## Recommended project-local counterpart

Global dir alone is not enough. Pair it with a project-local layout too:

```text
your-project/
└── .betterprompt/
    ├── skills/
    ├── outputs/
    └── logs/
    └── tmp/
```

Rule of thumb:

- `~/.betterprompt/` = user/global state
- `./.betterprompt/` = project-specific skills and output artifacts

Project-local should override global when both exist.

## Design principles behind this layout

### 1. Separate durable state from cache

Durable:

- installed manifests
- output history
- auth state

Ephemeral:

- temp files
- cached responses

### 2. Keep protected prompts protected

Installed skills should keep:

- schema
- metadata
- skill wrapper

Not:

- full private prompt body

### 3. Make agent integration explicit

`skills/` is a first-class folder, not an afterthought.

### 4. Make debugging easy

A real `outputs/` tree with request/response snapshots will save a lot of time.

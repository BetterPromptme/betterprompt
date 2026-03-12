#!/usr/bin/env bash
set -euo pipefail

REPO="BetterPromptme/betterprompt"
BINARY_NAME="betterprompt"
SYMLINK_NAME="bp"
BIN_DIR="$HOME/.local/bin"

# Detect OS
case "$(uname -s)" in
  Darwin) OS="darwin" ;;
  Linux)  OS="linux" ;;
  *)
    echo "Error: Unsupported operating system: $(uname -s)" >&2
    echo "This installer supports macOS and Linux only." >&2
    exit 1
    ;;
esac

# Detect architecture
case "$(uname -m)" in
  x86_64)        ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo "Error: Unsupported architecture: $(uname -m)" >&2
    echo "This installer supports x64 and arm64 only." >&2
    exit 1
    ;;
esac

echo "Detected platform: ${OS}-${ARCH}"

# Fetch latest version from GitHub API
echo "Fetching latest release..."
API_RESPONSE=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest") || {
  echo "Error: Failed to fetch latest release from GitHub API." >&2
  exit 1
}

if command -v jq &>/dev/null; then
  LATEST_TAG=$(echo "$API_RESPONSE" | jq -r '.tag_name')
else
  LATEST_TAG=$(echo "$API_RESPONSE" | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
fi

if [ -z "$LATEST_TAG" ] || [ "$LATEST_TAG" = "null" ]; then
  echo "Error: Could not determine latest release version." >&2
  exit 1
fi

VERSION="${LATEST_TAG#v}"
echo "Latest version: ${VERSION}"

# Construct download URL
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${BINARY_NAME}-${VERSION}-${OS}-${ARCH}"

# Download binary to a temp file
TMPDIR_PATH=$(mktemp -d)
TMPFILE="${TMPDIR_PATH}/${BINARY_NAME}"
trap 'rm -rf "$TMPDIR_PATH"' EXIT

echo "Downloading ${BINARY_NAME} ${VERSION} for ${OS}-${ARCH}..."
curl -fsSL -o "$TMPFILE" "$DOWNLOAD_URL"
chmod +x "$TMPFILE"

# Verify checksum if sha256sum or shasum is available
CHECKSUM_URL="${DOWNLOAD_URL}.sha256"
CHECKSUM_FILE="${TMPDIR_PATH}/checksum.sha256"
if curl -fsSL -o "$CHECKSUM_FILE" "$CHECKSUM_URL" 2>/dev/null; then
  EXPECTED_HASH=$(awk '{print $1}' "$CHECKSUM_FILE")
  if command -v sha256sum &>/dev/null; then
    ACTUAL_HASH=$(sha256sum "$TMPFILE" | awk '{print $1}')
  elif command -v shasum &>/dev/null; then
    ACTUAL_HASH=$(shasum -a 256 "$TMPFILE" | awk '{print $1}')
  else
    echo "Warning: No sha256sum or shasum found, skipping checksum verification." >&2
    ACTUAL_HASH="$EXPECTED_HASH"
  fi

  if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
    echo "Error: Checksum verification failed." >&2
    echo "  Expected: ${EXPECTED_HASH}" >&2
    echo "  Got:      ${ACTUAL_HASH}" >&2
    echo "The downloaded binary may be corrupted or tampered with." >&2
    exit 1
  fi
  echo "Checksum verified."
else
  echo "Warning: Checksum file not available, skipping verification." >&2
fi

# Install binary to versioned directory
VERSION_DIR="$HOME/.local/share/betterprompt/versions/${VERSION}"
mkdir -p "$VERSION_DIR"
mkdir -p "$BIN_DIR"

echo "Installing to ${VERSION_DIR}..."
mv "$TMPFILE" "${VERSION_DIR}/${BINARY_NAME}"
ln -sf "${VERSION_DIR}/${BINARY_NAME}" "${BIN_DIR}/${BINARY_NAME}"
ln -sf "${VERSION_DIR}/${BINARY_NAME}" "${BIN_DIR}/${SYMLINK_NAME}"

# Add ~/.local/bin to PATH in shell rc file
add_to_path() {
  SHELL_NAME=$(basename "$SHELL")
  EXPORT_LINE='export PATH="$HOME/.local/bin:$PATH"'

  case "$SHELL_NAME" in
    zsh)
      RC_FILE="$HOME/.zshrc"
      ;;
    bash)
      if [ "$OS" = "darwin" ]; then
        RC_FILE="$HOME/.bash_profile"
      else
        RC_FILE="$HOME/.bashrc"
      fi
      ;;
    fish)
      FISH_CONFIG="$HOME/.config/fish/config.fish"
      if [ -f "$FISH_CONFIG" ] && grep -q '.local/bin' "$FISH_CONFIG"; then
        return
      fi
      mkdir -p "$(dirname "$FISH_CONFIG")"
      echo 'fish_add_path "$HOME/.local/bin"' >> "$FISH_CONFIG"
      echo "Added ~/.local/bin to PATH in ${FISH_CONFIG}"
      return
      ;;
    *)
      echo "Add ~/.local/bin to your PATH manually."
      return
      ;;
  esac

  # For bash/zsh
  if [ -f "$RC_FILE" ] && grep -q '.local/bin' "$RC_FILE"; then
    return
  fi
  echo "" >> "$RC_FILE"
  echo "$EXPORT_LINE" >> "$RC_FILE"
  echo "Added ~/.local/bin to PATH in ${RC_FILE}"
}

add_to_path

echo ""
echo "BetterPrompt CLI ${VERSION} installed successfully!"
echo "  Binary:  ${VERSION_DIR}/${BINARY_NAME}"
echo "  Symlink: ${BIN_DIR}/${BINARY_NAME} -> ${VERSION_DIR}/${BINARY_NAME}"
echo "  Symlink: ${BIN_DIR}/${SYMLINK_NAME} -> ${VERSION_DIR}/${BINARY_NAME}"
echo ""
if [ -n "${RC_FILE:-}" ]; then
  echo "Run 'source ${RC_FILE}' or open a new terminal, then:"
  echo "  bp --help"
else
  echo "Run 'bp --help' to get started."
fi

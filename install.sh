#!/usr/bin/env bash
set -euo pipefail

REPO="BetterPromptme/betterprompt"
BINARY_NAME="betterprompt"
SYMLINK_NAME="bp"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"

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
LATEST_TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')

if [ -z "$LATEST_TAG" ]; then
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

# Install binary
mkdir -p "$INSTALL_DIR"

NEED_SUDO=""
if [ ! -w "$INSTALL_DIR" ]; then
  NEED_SUDO="sudo"
  echo "Installing to ${INSTALL_DIR} (requires sudo)..."
else
  echo "Installing to ${INSTALL_DIR}..."
fi

$NEED_SUDO mv "$TMPFILE" "${INSTALL_DIR}/${BINARY_NAME}"
$NEED_SUDO ln -sf "${INSTALL_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${SYMLINK_NAME}"

echo ""
echo "BetterPrompt CLI ${VERSION} installed successfully!"
echo "  ${INSTALL_DIR}/${BINARY_NAME}"
echo "  ${INSTALL_DIR}/${SYMLINK_NAME} -> ${BINARY_NAME}"
echo ""
echo "Run 'bp --help' to get started."

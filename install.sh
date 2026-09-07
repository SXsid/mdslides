#!/usr/bin/env sh
# mdslides automated installer
# Usage: curl -fsSL https://raw.githubusercontent.com/SXsid/mdslides/main/install.sh | bash

set -e

REPO="SXsid/mdslides"
BINARY_NAME="mdslides"

info() {
  printf "[info] %s\n" "$1"
}

error() {
  printf "[error] %s\n" "$1" >&2
  exit 1
}

# Detect Operating System
detect_os() {
  case "$(uname -s)" in
    Linux*)   echo "linux" ;;
    Darwin*)  echo "darwin" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) error "Unsupported operating system: $(uname -s)" ;;
  esac
}

# Detect Machine Architecture
detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64)  echo "amd64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) error "Unsupported CPU architecture: $(uname -m)" ;;
  esac
}

# Determine download tool
fetch_url() {
  url="$1"
  dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$dest" "$url"
  else
    error "Neither curl nor wget was found in PATH. Please install either to continue."
  fi
}

fetch_json() {
  url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$url"
  fi
}

# Verify SHA256 checksum
verify_checksum() {
  file="$1"
  checksum_file="$2"
  filename="$(basename "$file")"

  if command -v sha256sum >/dev/null 2>&1; then
    expected_hash="$(grep "$filename" "$checksum_file" | awk '{print $1}')"
    if [ -n "$expected_hash" ]; then
      actual_hash="$(sha256sum "$file" | awk '{print $1}')"
      if [ "$expected_hash" != "$actual_hash" ]; then
        error "Checksum verification failed for $filename"
      fi
      info "Checksum verified successfully."
    fi
  elif command -v shasum >/dev/null 2>&1; then
    expected_hash="$(grep "$filename" "$checksum_file" | awk '{print $1}')"
    if [ -n "$expected_hash" ]; then
      actual_hash="$(shasum -a 256 "$file" | awk '{print $1}')"
      if [ "$expected_hash" != "$actual_hash" ]; then
        error "Checksum verification failed for $filename"
      fi
      info "Checksum verified successfully."
    fi
  fi
}

main() {
  OS="$(detect_os)"
  ARCH="$(detect_arch)"
  info "Detected platform: ${OS}/${ARCH}"

  if [ -z "$VERSION" ]; then
    info "Resolving latest release from GitHub (${REPO})..."
    RELEASE_DATA="$(fetch_json "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null || true)"
    VERSION="$(echo "$RELEASE_DATA" | grep '"tag_name":' | head -n 1 | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"
    
    if [ -z "$VERSION" ]; then
      info "Could not query GitHub API for latest tag, falling back to repository releases..."
      # If rate-limited on api.github.com, extract redirected tag
      REDIRECT_URL="$(curl -fsSL -o /dev/null -w "%{url_effective}" "https://github.com/${REPO}/releases/latest" 2>/dev/null || true)"
      VERSION="$(echo "$REDIRECT_URL" | sed -E 's#.*/tag/([^/]+).*#\1#')"
    fi
  fi

  if [ -z "$VERSION" ]; then
    error "Unable to determine release version. You can manually specify a version via: VERSION=v0.1.0 sh install.sh"
  fi

  info "Selected version: ${VERSION}"

  EXT="tar.gz"
  BIN_EXT=""
  if [ "$OS" = "windows" ]; then
    EXT="zip"
    BIN_EXT=".exe"
  fi

  ARCHIVE_NAME="mdslides-${VERSION}-${OS}-${ARCH}.${EXT}"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${ARCHIVE_NAME}"
  CHECKSUM_URL="https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt"

  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

  info "Downloading ${ARCHIVE_NAME}..."
  fetch_url "$DOWNLOAD_URL" "${TMP_DIR}/${ARCHIVE_NAME}"

  info "Downloading checksums.txt..."
  if fetch_url "$CHECKSUM_URL" "${TMP_DIR}/checksums.txt" 2>/dev/null; then
    verify_checksum "${TMP_DIR}/${ARCHIVE_NAME}" "${TMP_DIR}/checksums.txt"
  fi

  info "Extracting archive..."
  if [ "$EXT" = "zip" ]; then
    unzip -q -o "${TMP_DIR}/${ARCHIVE_NAME}" -d "${TMP_DIR}"
  else
    tar -xzf "${TMP_DIR}/${ARCHIVE_NAME}" -C "${TMP_DIR}"
  fi

  SOURCE_BIN="${TMP_DIR}/${BINARY_NAME}${BIN_EXT}"
  if [ ! -f "$SOURCE_BIN" ]; then
    error "Binary not found in extracted archive."
  fi

  # Determine installation destination
  INSTALL_DIR="/usr/local/bin"
  USE_SUDO=0

  if [ -w "$INSTALL_DIR" ]; then
    TARGET_PATH="${INSTALL_DIR}/${BINARY_NAME}${BIN_EXT}"
  elif command -v sudo >/dev/null 2>&1 && [ -t 0 ]; then
    info "Installing to ${INSTALL_DIR} requires administrative privileges."
    USE_SUDO=1
    TARGET_PATH="${INSTALL_DIR}/${BINARY_NAME}${BIN_EXT}"
  else
    INSTALL_DIR="${HOME}/.local/bin"
    mkdir -p "$INSTALL_DIR"
    TARGET_PATH="${INSTALL_DIR}/${BINARY_NAME}${BIN_EXT}"
  fi

  info "Installing to ${TARGET_PATH}..."
  if [ "$USE_SUDO" -eq 1 ]; then
    sudo cp "$SOURCE_BIN" "$TARGET_PATH"
    sudo chmod +x "$TARGET_PATH"
  else
    cp "$SOURCE_BIN" "$TARGET_PATH"
    chmod +x "$TARGET_PATH"
  fi

  info "Installation complete."
  printf "\n"
  printf "mdslides %s is now installed.\n" "$VERSION"
  printf "Location: %s\n" "$TARGET_PATH"
  printf "\n"

  # Check PATH
  case ":$PATH:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      printf "Notice: %s is not currently in your PATH.\n" "$INSTALL_DIR"
      printf "Add it by placing this in your shell profile (~/.bashrc or ~/.zshrc):\n\n"
      printf "  export PATH=\"%s:\$PATH\"\n\n" "$INSTALL_DIR"
      ;;
  esac

  printf "Usage: mdslides <presentation.md>\n\n"
}

main "$@"

# Binary Distribution and GitHub Releases

This document describes how mdslides compiles, packages, and distributes standalone binaries for multiple platforms, and how maintainers publish releases.

---

## Overview

mdslides compiles into a single static binary with all viewer assets (HTML templates, CSS styles, and ES modules) embedded via Go `embed`. Users do not need Node.js, npm, Docker, or external runtimes to view or serve presentations.

We provide pre-compiled binaries for the following architectures:

| Platform | Architecture | Binary Name | Archive Format |
|---|---|---|---|
| Linux | x86_64 (`amd64`) | `mdslides` | `.tar.gz` |
| Linux | ARM64 (`arm64`) | `mdslides` | `.tar.gz` |
| macOS | Apple Silicon (`arm64`) | `mdslides` | `.tar.gz` |
| macOS | Intel (`amd64`) | `mdslides` | `.tar.gz` |
| Windows | x86_64 (`amd64`) | `mdslides.exe` | `.zip` |
| Windows | ARM64 (`arm64`) | `mdslides.exe` | `.zip` |

---

## Publishing Releases to GitHub

The repository includes an automated GitHub Actions release workflow located at [`.github/workflows/release.yml`](../.github/workflows/release.yml).

### Step-by-Step Maintainer Workflow

1. Ensure the working tree is clean and all tests pass:
   ```bash
   make check
   ```

2. Tag the commit with the new semantic version (prefixed with `v`):
   ```bash
   git tag v1.0.0
   ```

3. Push the tag to GitHub:
   ```bash
   git push origin v1.0.0
   ```

4. The GitHub Actions runner will automatically:
   - Check out the repository at the tag.
   - Cross-compile stripped binaries for all 6 target platforms.
   - Inject the version string into `main.version` via `-ldflags`.
   - Package each target into an archive alongside `README.md` and `LICENSE`.
   - Calculate SHA-256 hashes and generate `checksums.txt`.
   - Create a GitHub Release under `https://github.com/SXsid/mdslides/releases/tag/v1.0.0` with release notes and assets attached.

---

## User Installation Methods

### 1. Universal One-Line Installer Script

Users on Linux or macOS can install mdslides with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/SXsid/mdslides/main/install.sh | bash
```

The installer script:
- Automatically detects the operating system and CPU architecture.
- Fetches the latest published release from the GitHub API.
- Downloads the corresponding archive and verifies its SHA-256 checksum against `checksums.txt`.
- Unpacks the binary to `/usr/local/bin` (or `~/.local/bin` if non-root).
- Verifies that the installation path is present in the user's `PATH`.

To install a specific version rather than the latest:
```bash
VERSION=v1.0.0 curl -fsSL https://raw.githubusercontent.com/SXsid/mdslides/main/install.sh | bash
```

### 2. Direct Download from GitHub Releases

Users can manually download the archive matching their operating system from:
`https://github.com/SXsid/mdslides/releases`

Example manual installation on Linux:
```bash
# Download archive and checksums
curl -LO https://github.com/SXsid/mdslides/releases/download/v1.0.0/mdslides-v1.0.0-linux-amd64.tar.gz
curl -LO https://github.com/SXsid/mdslides/releases/download/v1.0.0/checksums.txt

# Verify checksum
sha256sum --ignore-missing -c checksums.txt

# Extract and move to PATH
tar -xzf mdslides-v1.0.0-linux-amd64.tar.gz
sudo mv mdslides /usr/local/bin/
```

### 3. Install via Go Toolchain

Users who have Go installed can build and install directly from source:

```bash
go install github.com/SXsid/mdslides/cmd/mdslides@latest
```

### 4. Local Build & Packaging

To compile distribution archives locally:

```bash
# Build raw binaries in dist/
make dist

# Build compressed archives with checksums in dist/
make release-local
```

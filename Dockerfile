# =============================================================================
# Whap — WhatsApp Mock Server Development Tool
# =============================================================================
#
# Build stages:
#   deps     — install production + dev dependencies with frozen lockfile
#   build    — compile TypeScript to a self-contained Bun binary (dist/whap)
#   debug    — development/debug image with full source and Bun debugger support
#   final    — minimal runtime image; the compiled binary embeds the Bun
#              runtime, so no Bun installation is required at runtime
#
# Available commands inside the container:
#   /app/dist/whap server          — start mock server on port 3010
#   /app/dist/whap tui             — start interactive TUI (requires TTY)
#   /app/dist/whap --help          — list all available subcommands
#
# For development tasks (tests, linting) use the 'build' stage directly:
#   docker build --target build --tag whap:dev .
#   docker run --rm whap:dev bun run test
#   docker run --rm whap:dev bunx biome check src/
#   docker run --rm whap:dev bun tsc --noEmit
#
# For debugging with source code and Bun Inspector:
#   docker build --target debug --tag whap:debug .
#   docker run --rm -it -p 3010:3010 -p 9229:9229 whap:debug bun --inspect-brk src/index.ts server
#   Then connect your IDE debugger (VSCode, etc.) to localhost:9229
#
# =============================================================================

# Pin the Bun image to a specific minor version for reproducibility.
# Update this tag intentionally when upgrading Bun.
# https://hub.docker.com/r/oven/bun/tags
ARG BUN_VERSION=1.2

# -----------------------------------------------------------------------------
# Stage 1: deps
# Install all dependencies (including devDependencies needed for build/test).
# We copy only the lockfile and manifests first so Docker can cache this layer
# independently of source-code changes.
# -----------------------------------------------------------------------------
FROM oven/bun:${BUN_VERSION} AS deps

WORKDIR /app

# Copy dependency manifests before source so the install layer is cached
# as long as these files are unchanged.
COPY package.json bun.lock ./

# --frozen-lockfile: fail if bun.lock is out of date (prevents silent drift).
# --ignore-scripts: do not run arbitrary postinstall scripts (security hygiene).
RUN bun install --frozen-lockfile --ignore-scripts

# -----------------------------------------------------------------------------
# Stage 2: build
# Compile the TypeScript source into a single self-contained binary.
# The --compile flag bundles the Bun runtime into the output binary, so the
# final image does not need Bun present at all.
# -----------------------------------------------------------------------------
FROM oven/bun:${BUN_VERSION} AS build

WORKDIR /app

# Bring in installed node_modules from the deps stage.
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source tree. This layer changes on every code edit.
COPY . .

# Produce dist/whap — a statically-linked, self-contained executable.
# See package.json: "bun build src/index.ts --compile --outfile dist/whap"
RUN bun run build

# -----------------------------------------------------------------------------
# Stage 3: debug
# Development/debug image with full TypeScript source, node_modules, and Bun
# debugger support. Includes everything needed for interactive development and
# debugging with Bun Inspector.
#
# Usage:
#   docker build --target debug --tag whap:debug .
#   docker run --rm -it -p 3010:3010 -p 9229:9229 whap:debug \
#     bun --inspect-brk src/index.ts server
#
# Then connect your IDE debugger to localhost:9229 (VSCode, WebStorm, etc.)
# or use Bun's built-in debugger at chrome://inspect
# -----------------------------------------------------------------------------
FROM oven/bun:${BUN_VERSION} AS debug

WORKDIR /app

# Bring in installed dependencies from the deps stage.
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source tree including configuration files.
COPY . .

# Run type checking to catch errors early in the debug environment.
RUN bun tsc --noEmit

# The mock server listens on port 3010 by default.
# The Bun Inspector listens on port 9229 (standard debugging protocol).
EXPOSE 3010 9229

# Health check: verify the mock server is responsive on its main port.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD bun run -e "const res = await fetch('http://localhost:3010/health'); process.exit(res.ok ? 0 : 1)" || exit 1

# Default command runs the server with source maps and watch mode enabled.
# Users can override with --inspect or --inspect-brk for debugging:
#   docker run -it whap:debug bun --inspect-brk src/index.ts server
# Or run tests/linting:
#   docker run whap:debug bun run test
#   docker run whap:debug bunx biome check src/
ENTRYPOINT ["bun"]
CMD ["src/index.ts", "server"]

# -----------------------------------------------------------------------------
# Stage 4: final (default)
# Minimal runtime image. Only the compiled binary and optional config support
# are present — no Bun installation, no source code, no node_modules.
#
# The compiled binary already embeds the Bun runtime (--compile), so this
# stage uses debian:bookworm-slim as the base to keep the image small while
# retaining a working libc for binary execution and TTY/interactive support
# needed by the TUI.
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS final

# Install only the minimal runtime libraries needed:
#   ca-certificates — HTTPS calls from the mock server to real webhooks
#   curl            — used by the HEALTHCHECK to probe /health
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl \
    && rm --recursive --force /var/lib/apt/lists/*

# Run as a non-root user to follow least-privilege principles.
# UID/GID 1001 avoids conflicts with common system users.
RUN groupadd --gid 1001 whap \
    && useradd --uid 1001 --gid whap --no-create-home --shell /usr/sbin/nologin whap

WORKDIR /app

# Copy the compiled binary from the build stage.
COPY --from=build --chown=whap:whap /app/dist/whap ./whap

# Copy the bundled template files so the TemplateStore can load them at
# startup.  startServer() resolves './templates' relative to cwd (/app), so
# the directory must be present at /app/templates in the final image.
# Users can override these at runtime by mounting a volume onto /app/templates.
COPY --from=build --chown=whap:whap /app/templates ./templates

USER whap

# The mock server listens on port 3010 by default.
# Override with the --port flag: /app/whap server --port 8080
EXPOSE 3010

# Health check: the /health route is registered by whap's status router.
# a 200 means the server is alive and accepting requests.
# curl is installed above in the runtime stage; wget is not available in
# debian:bookworm-slim and was not installed.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD curl --fail --silent http://localhost:3010/health || exit 1

# Default command starts the mock server.
# Override at runtime:
#   docker run whap /app/whap tui              # interactive TUI (needs -t)
#   docker run whap /app/whap server --port 8080
#   docker run whap /app/whap --help
ENTRYPOINT ["/app/whap"]
CMD ["server"]

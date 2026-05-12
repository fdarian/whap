# =============================================================================
# Whap — Docker Operations Makefile
# =============================================================================
#
# Usage:
#   make <target>               Run a target with defaults
#   IMAGE_TAG=myver make ...    Override the image tag
#
# Targets are grouped:
#   Build     — build, build_debug
#   Run       — server, tui, whap_help
#   Dev tasks — test, typecheck, lint, format (use debug image)
#   Custom    — run (pass CMD=... for arbitrary commands)
#   Manage    — rm_containers, rmi, clean
#   Inspect   — images, ps
#
# Live source mounting (dev image):
#   Set SRC_DIR to your local src/ directory to reflect edits without rebuilding.
#   The directory is mounted read-only for test/typecheck/lint, and read-write
#   for format so Biome's output is written back to the host.
#
#   Examples:
#     SRC_DIR=./src make test
#     SRC_DIR=./src make typecheck
#     SRC_DIR=./src make lint
#     SRC_DIR=./src make format
#
# Live source mounting (production/final image):
#   The final image runs the compiled binary; it does not need the TypeScript
#   source
# =============================================================================

# -----------------------------------------------------------------------------
# Variables — override on the command line or in the environment
# -----------------------------------------------------------------------------

# Image repository and name. Override IMAGE_REPO to push to a registry.
IMAGE_REPO  ?=
IMAGE_NAME  ?= whap

# Tag applied to the production image built by build.
# Defaults to the version in package.json (extracted with bun -e).
IMAGE_TAG   ?= $(shell bun -e "console.log(require('./package.json').version)")

# Tag applied to the debug image built by build_debug.
DEBUG_TAG   ?= debug

# Fully-qualified image references.
# If IMAGE_REPO is set, images are prefixed with "repo/"; otherwise bare name.
_REPO_PREFIX = $(if $(IMAGE_REPO),$(IMAGE_REPO)/,)
IMAGE        = $(_REPO_PREFIX)$(IMAGE_NAME):$(IMAGE_TAG)
# Debug image reference: same name, separate tag so production and debug images
# can coexist locally without the debug image clobbering the release tag.
DEBUG_IMAGE  = $(_REPO_PREFIX)$(IMAGE_NAME):$(DEBUG_TAG)

# Host port mapped to the container's port 3010.
SERVER_PORT ?= 3010

# Name of the running whap container to attach to with the tui target.
CONTAINER_NAME ?= whap

# Path to the local src/ directory to mount into the debug image for live editing.
# When set, the directory is overlaid onto /app/src inside the container so that
# dev tasks (test, typecheck, lint, format) operate on the current file tree
# without requiring a rebuild of the debug image.
#
# The mount is read-only for all dev tasks except format, where it must be
# read-write so Biome can write changes back to the host filesystem.
#
# Example: SRC_DIR=./src make test
SRC_DIR ?=

# Internal helpers: inject --volume only when SRC_DIR is set.
# :ro — safe default; the container cannot modify host files.
_SRC_MOUNT_RO = $(if $(SRC_DIR),--volume $(abspath $(SRC_DIR)):/app/src:ro,)
# :rw — required for format so Biome's --write flag reaches the host.
_SRC_MOUNT_RW = $(if $(SRC_DIR),--volume $(abspath $(SRC_DIR)):/app/src:rw,)

# Command to run with run (arbitrary whap subcommand).
CMD ?= --help

# Dockerfile location (project root).
DOCKERFILE = Dockerfile

# -----------------------------------------------------------------------------
# Phony declarations — targets that never produce files.
# -----------------------------------------------------------------------------
.PHONY: help \
        build build_debug \
        server tui whap_help run \
        test typecheck lint format \
        rm_containers rmi clean \
        images ps

# -----------------------------------------------------------------------------
# Default target: print help.
# -----------------------------------------------------------------------------
help:
	@printf '\nWhap Docker Makefile\n'
	@printf '====================\n\n'
	@printf 'Build targets:\n'
	@printf '  build             Build the production image ($(IMAGE))\n'
	@printf '  build_debug       Build the debug stage: Bun + source + debugger support ($(DEBUG_IMAGE))\n'
	@printf '\nRun targets:\n'
	@printf '  server            Start the mock server on port $(SERVER_PORT)\n'
	@printf '  tui               Attach the interactive TUI to the running container\n'
	@printf '  whap_help         Print whap CLI help text\n'
	@printf '  run               Run an arbitrary whap command (CMD=<subcommand>)\n'
	@printf '\nDev task targets (use dev image):\n'
	@printf '  test              Run the test suite with vitest\n'
	@printf '  typecheck         Run TypeScript type checking (tsc --noEmit)\n'
	@printf '  lint              Run Biome linter (biome check src/)\n'
	@printf '  format            Run Biome formatter (biome format --write src/)\n'
	@printf '\nImage management targets:\n'
	@printf '  rm_containers     Stop and remove all whap containers\n'
	@printf '  rmi               Remove production and dev images\n'
	@printf '  clean             Remove containers and images\n'
	@printf '\nInspection targets:\n'
	@printf '  images            List Docker images matching whap\n'
	@printf '  ps                List running Docker containers\n'
	@printf '\nVariables (override on the command line):\n'
	@printf '  IMAGE_NAME=whap   Image name (default: whap)\n'
	@printf '  IMAGE_TAG=<ver>   Production image tag (default: from package.json)\n'
	@printf '  DEBUG_TAG=debug   Debug image tag (default: debug) — used by build_debug\n'
	@printf '  IMAGE_REPO=       Optional registry prefix (e.g. ghcr.io/myorg)\n'
	@printf '  SERVER_PORT=3010  Host port mapped to container port 3010\n'
	@printf '  CONTAINER_NAME=whap  Running container to attach to with tui target\n'
	@printf '  SRC_DIR=          Local src/ directory to mount into the debug image\n'
	@printf '                    Enables live editing without rebuilding the image\n'
	@printf '                    Mounted :ro for test/typecheck/lint, :rw for format\n'
	@printf '  CMD=--help        Subcommand for run target\n'
	@printf '\nExamples:\n'
	@printf '  make build                       # build production image\n'
	@printf '  make build_debug                 # build debug image (debug stage)\n'
	@printf '  make server\n'
	@printf '  make run CMD="server --port 8080"\n'
	@printf '  make test\n'
	@printf '  SRC_DIR=./src make test          # run tests against live source\n'
	@printf '  SRC_DIR=./src make typecheck     # type-check live source\n'
	@printf '  SRC_DIR=./src make lint          # lint live source\n'
	@printf '  SRC_DIR=./src make format        # format and write back to host\n'
	@printf '  IMAGE_TAG=1.0.0 make build\n\n'

# =============================================================================
# Build targets
# =============================================================================

## build: Build the production image using the 'final' stage.
# The 'final' stage is the minimal runtime image: debian:bookworm-slim with
# only the compiled self-contained binary (dist/whap).  No Bun, no source,
# no node_modules.  This is the image used by server/tui/run targets.
build:
	docker build \
		--file $(DOCKERFILE) \
		--target final \
		--tag $(IMAGE) \
		.

## build_debug: Build the debug image using the 'debug' stage.
# The 'debug' stage includes Bun, node_modules, and the full source tree,
# making it suitable for running tests, type checks, linters, and debugging.
# Provides Bun Inspector support on port 9229 for interactive debugging.
# Tagged as $(DEBUG_IMAGE) so it does not overwrite the production image tag.
build_debug:
	docker build \
		--file $(DOCKERFILE) \
		--target debug \
		--tag $(DEBUG_IMAGE) \
		.

# =============================================================================
# Run targets (production image)
# =============================================================================

## server: Start the mock server, mapping SERVER_PORT on the host.
# --rm removes the container after it stops (no leftover containers).
server: build
	docker run \
		--rm \
		--publish $(SERVER_PORT):3010 \
		$(IMAGE) \
		server

## tui: Attach the interactive TUI to the running whap container.
# Execs into the container named CONTAINER_NAME (default: whap) so the TUI
# shares the server's state (messages, webhooks, templates) without starting
# a second process.  --interactive --tty are both required: Ink drives the
# terminal via raw-mode stdin; without a TTY the UI cannot render.
tui:
	docker exec \
		--interactive \
		--tty \
		$(CONTAINER_NAME) \
		/app/whap tui

## whap_help: Print the whap CLI help text and exit.
whap_help: build
	docker run \
		--rm \
		$(IMAGE) \
		--help

## run: Run an arbitrary whap subcommand.
# Set CMD to the desired subcommand (and flags), e.g.:
#   make run CMD="server --port 8080"
#   make run CMD="tui"
run: build
	docker run \
		--rm \
		--name $(CONTAINER_NAME) \
		--interactive \
		--tty \
		$(IMAGE) \
		$(CMD)

# =============================================================================
# Dev task targets (debug image — includes Bun, source, devDependencies, debugger)
# =============================================================================

## test: Run the vitest test suite inside the debug image.
# Pass SRC_DIR=./src to run against live source without rebuilding:
#   SRC_DIR=./src make test
test: build_debug
	docker run \
		--rm \
		$(_SRC_MOUNT_RO) \
		$(DEBUG_IMAGE) \
		bun run test

## typecheck: Run tsc --noEmit inside the debug image.
# Pass SRC_DIR=./src to type-check live source without rebuilding:
#   SRC_DIR=./src make typecheck
typecheck: build_debug
	docker run \
		--rm \
		$(_SRC_MOUNT_RO) \
		$(DEBUG_IMAGE) \
		bun tsc --noEmit

## lint: Run the Biome linter against src/ inside the debug image.
# Pass SRC_DIR=./src to lint live source without rebuilding:
#   SRC_DIR=./src make lint
lint: build_debug
	docker run \
		--rm \
		$(_SRC_MOUNT_RO) \
		$(DEBUG_IMAGE) \
		bunx biome check src/

## format: Run the Biome formatter with --write against src/.
# Without SRC_DIR, changes are written inside the container and lost when it
# exits.  Pass SRC_DIR=./src to write formatted files back to the host:
#   SRC_DIR=./src make format
# The mount is :rw (read-write) so Biome's output reaches the host filesystem.
format: build_debug
	docker run \
		--rm \
		$(_SRC_MOUNT_RW) \
		$(DEBUG_IMAGE) \
		bunx biome format --write src/

# =============================================================================
# Image management targets
# =============================================================================

## rm_containers: Stop and remove every container created from whap images.
# Queries both the production image and the debug image so containers from
# either build are cleaned up.  Safe to run when no containers exist.
rm_containers:
	`@CONTAINERS`=$$(docker ps --all --quiet --filter ancestor=$(IMAGE)); \
	CONTAINERS="$$CONTAINERS $$(docker ps --all --quiet --filter ancestor=$(DEBUG_IMAGE))"; \
	if [ -n "$$CONTAINERS" ]; then \
		docker rm --force $$CONTAINERS; \
	else \
		echo "No whap containers to remove."; \
	fi

## rmi: Remove the production and debug images (if they exist).
rmi:
	@docker rmi --force $(IMAGE) 2>/dev/null || echo "Image $(IMAGE) not found, skipping."
	@docker rmi --force $(DEBUG_IMAGE) 2>/dev/null || echo "Image $(DEBUG_IMAGE) not found, skipping."

## clean: Remove all whap containers then the whap images.
clean: rm_containers rmi

# =============================================================================
# Inspection targets
# =============================================================================

## images: List all Docker images whose repository contains "whap".
images:
	docker images --filter reference='*whap*'

## ps: List all running Docker containers.
ps:
	docker ps

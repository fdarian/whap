# Task 1: Install Brocli Dependency

## Overview
Add the `@drizzle-team/brocli` package to the project dependencies to enable CLI command routing functionality.

## Implementation Steps

1. **Add Brocli to dependencies**
   ```bash
   pnpm add @drizzle-team/brocli
   ```

2. **Verify installation**
   - Check that `@drizzle-team/brocli` appears in `package.json` dependencies
   - Ensure `pnpm-lock.yaml` is updated
   - Verify no installation errors or peer dependency warnings

## Technical Requirements

- Use `pnpm` package manager (never `npm` or `yarn`)
- Add to `dependencies` (not `devDependencies`) since it's needed at runtime
- Verify compatibility with existing Node.js and TypeScript versions

## Expected Changes

**package.json**:
- New entry in `dependencies` section: `"@drizzle-team/brocli": "^<version>"`

**pnpm-lock.yaml**:
- Updated with new dependency and its transitive dependencies

## Validation Steps

1. **Installation check**:
   ```bash
   pnpm list @drizzle-team/brocli
   ```

2. **Import test** (optional verification):
   ```bash
   node -e "console.log(require('@drizzle-team/brocli'))"
   ```

## Notes

- Brocli is a CLI framework that provides command routing, argument parsing, and help generation
- It's designed to work well with TypeScript and provides good developer experience
- The package should be compatible with the existing ES modules setup

## Next Steps

After completion, proceed to [Task 2: Move TUI entry point and update imports](./task_2.md)

## Completion Notes

**Completion Date:** 2025-08-20

**Implementation Summary:**
Successfully installed `@drizzle-team/brocli` version 0.11.0 using pnpm. The package was added to the dependencies section in package.json and installation completed without errors.

**Challenges Encountered:**
- None - installation was straightforward

**Lessons Learned:**
- Brocli v0.11.0 is compatible with the existing TypeScript/ES modules setup
- Package properly integrates with pnpm package management

**Follow-up Items:**
- [x] Task completed successfully
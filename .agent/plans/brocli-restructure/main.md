# Brocli CLI Restructure Implementation Plan

## End Goals

- [x] Unified CLI application using Brocli for command routing
- [x] Users can run `pnpm whap server` to start the mock server
- [x] Users can run `pnpm whap tui` to start the interactive chat interface
- [x] All existing functionality is preserved and working
- [x] Proper TypeScript compilation with ES modules and explicit extensions
- [x] Package.json includes `bin` field for CLI distribution
- [x] Help command provides useful information about available commands
- [x] Error handling and graceful shutdown work correctly for both commands

## Context Map

This plan transforms the current WhatsApp mock server project from having two separate entry points into a unified CLI application using Brocli (`@drizzle-team/brocli`).

### Current Architecture
- **Entry Points**: Two separate entry points (`src/index.tsx` for TUI, `src/server/server.ts` for server)
- **Package Scripts**: `start:server` and `start:cli` run separate commands
- **Structure**: Direct execution of individual components

### Target Architecture
- **Single Entry Point**: `src/index.ts` as main CLI entry using Brocli
- **Commands**: `server` and `tui` commands routed through Brocli
- **Structure**: Command-based routing with preserved functionality

### Technical Constraints
- Must maintain ES module compatibility with explicit `.ts`/`.tsx` extensions
- Use `pnpm` as package manager (never `npm` or `yarn`)
- No barrel files or centralized types
- Preserve all existing functionality without breaking changes
- Maintain TypeScript strict compilation

### Dependencies
- **Add**: `@drizzle-team/brocli` for CLI command routing
- **Keep**: All existing dependencies (React, Ink, Hono, etc.)

## Step-by-Step Plan

### Phase 1: Setup and Dependencies
- [x] Install Brocli dependency → [See task_1.md](./task_1.md)

### Phase 2: File Restructuring
- [x] Move TUI entry point and update imports → [See task_2.md](./task_2.md)

### Phase 3: Brocli Implementation
- [x] Create main CLI entry point with Brocli → [See task_3.md](./task_3.md)
- [x] Implement server command → [See task_4.md](./task_4.md)
- [x] Implement TUI command → [See task_5.md](./task_5.md)

### Phase 4: Package Configuration
- [x] Update package.json with bin field and scripts → [See task_6.md](./task_6.md)

### Phase 5: Testing and Validation
- [x] Test server command functionality → [See task_7.md](./task_7.md)
- [x] Test TUI command functionality → [See task_8.md](./task_8.md)
- [x] Verify help command and error handling → [See task_9.md](./task_9.md)

## Notes and Considerations

### Critical Requirements
1. **ES Modules**: All imports must use explicit `.ts`/`.tsx` extensions
2. **No Breaking Changes**: Existing functionality must work identically
3. **Signal Handling**: Preserve proper SIGINT/SIGTERM handling for both commands
4. **Error Handling**: Maintain graceful error handling and user feedback

### Implementation Strategy
- Create Brocli commands that wrap existing functionality rather than rewriting
- Preserve existing signal handlers and cleanup logic
- Maintain environment variable handling (dotenv)
- Keep terminal compatibility checks for TUI command

### Potential Issues
- Import path updates may require careful attention to relative paths
- TypeScript compilation needs verification with new structure
- Signal handling coordination between Brocli and existing handlers

## Success Criteria

1. **Functional Commands**: Both `pnpm whap server` and `pnpm whap tui` work correctly
2. **Preserved Features**: All existing functionality works without regression
3. **Error Handling**: Proper error messages and graceful shutdown
4. **Help System**: `pnpm whap --help` and `pnpm whap <command> --help` work
5. **TypeScript**: Clean compilation without errors
6. **Package Distribution**: Bin field allows global installation and usage

---
*Plan created: 2025-08-20*
*Last updated: 2025-08-20*
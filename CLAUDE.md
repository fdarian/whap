# Whap: WhatsApp Mock Server Development Tool

##  Project Overview

This is a **WhatsApp Mock Server Development Tool** - a comprehensive development environment for testing WhatsApp integrations without using real WhatsApp Cloud API endpoints, phone numbers, or incurring API costs.

### Two Main Components
1. **Mock Server** ([src/server/server.ts](mdc:src/server/server.ts)) - Hono-based server that mimics WhatsApp Cloud API endpoints
2. **Interactive TUI** ([src/tui/index.tsx](mdc:src/tui/index.tsx)) - React + Ink terminal UI for real-time testing and monitoring

### CLI Architecture
- **Entry Point**: [src/index.ts](mdc:src/index.ts) - Main CLI router using [Brocli](https://github.com/drizzle-team/brocli)
- **Commands**: `src/commands/` - Individual command implementations
  - `server.ts` - Starts mock server (configurable port)
  - `tui.ts` - Starts interactive interface (configurable server URL)
- **Binary**: Registered as `whap` in package.json bin field

### Development Workflow
```bash
# Using CLI commands (primary method)
pnpm whap server        # Start mock server on port 3010
pnpm whap tui           # Start TUI interface

# Or with options
pnpm whap server --port 3011
pnpm whap tui --server-url http://localhost:3011
```

### Critical Rules (ALWAYS FOLLOW)
- **Use `pnpm`** - Never use `npm` or `yarn`
- **No barrel files** - Keep imports direct and explicit
- **No centralized `types.ts`** - Define types beside functions
- **Use explicit `.ts`/`.tsx` extensions** in imports (ES modules requirement)
- **Never run interactive CLI commands** when working on interface improvements

### Key Navigation
- **CLI Entry**: `src/index.ts` - Brocli-based command router
- **Commands**: `src/commands/` - CLI command implementations
- **Server**: `src/server/` - API endpoints, storage, types
- **TUI Components**: `src/components/` - React components for terminal interface
- **Scripts**: Check [package.json](mdc:package.json) for available commands
- **Port**: Mock server runs on port 3010 (default)

### Detailed Information
- Architecture & Components: [whatsapp-architecture.mdc](mdc:.cursor/rules/whatsapp-architecture.mdc)
- Development Guidelines: [whatsapp-development.mdc](mdc:.cursor/rules/whatsapp-development.mdc)
- Technology Stack: [whatsapp-tech-stack.mdc](mdc:.cursor/rules/whatsapp-tech-stack.mdc)
- Coding Conventions: [whatsapp-conventions.mdc](mdc:.cursor/rules/whatsapp-conventions.mdc)


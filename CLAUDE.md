# Whap: WhatsApp Mock Server Development Tool

##  Project Overview

This is a **WhatsApp Mock Server Development Tool** - a comprehensive development environment for testing WhatsApp integrations without using real WhatsApp Cloud API endpoints, phone numbers, or incurring API costs.

### Two Main Components
1. **Mock Server** ([src/server/server.ts](src/server/server.ts)) - Hono-based server that mimics WhatsApp Cloud API endpoints
2. **Interactive TUI** ([src/tui/index.tsx](src/tui/index.tsx)) - React + Ink terminal UI for real-time testing and monitoring

### CLI Architecture
```bash
# Using CLI commands (primary method)
bun whap               # Main CLI entrypoint
bun whap server        # Start mock server on port 3010
bun whap tui           # Start TUI interface
```

- **Entry Point**: [src/index.ts](src/index.ts) - Main CLI router using [Brocli](https://github.com/drizzle-team/brocli)
- **Commands**: `src/commands/` - Individual command implementations
  - `server.ts` - Starts mock server (configurable port)
  - `tui.ts` - Starts interactive interface (configurable server URL)
- **Binary**: Registered as `whap` in package.json bin field

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


## Development Workflow
**Verifying changes**:
- `bun tsc --noEmit` for typecheck
- `bun run build` for compilation into executable binary

**Critical Rules (ALWAYS FOLLOW)**
- **No barrel files** - Keep imports direct and explicit
- **No centralized `types.ts`** - Define types beside functions
- **Use explicit `.ts`/`.tsx` extensions** in imports (ES modules requirement)

## Bun

We use Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bun -e "<code>"` instead of `node -e "<code>"`

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

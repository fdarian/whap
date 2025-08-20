# Whap: WhatsApp Mock Server Development Tool

##  Project Overview

This is a **WhatsApp Mock Server Development Tool** - a comprehensive development environment for testing WhatsApp integrations without using real WhatsApp Cloud API endpoints, phone numbers, or incurring API costs.

### Two Main Components
1. **Mock Server** ([src/server/server.ts](mdc:src/server/server.ts)) - Hono-based server that mimics WhatsApp Cloud API endpoints
2. **Interactive CLI** ([src/tui/index.tsx](mdc:src/tui/index.tsx)) - React + Ink CLI for real-time testing and monitoring

### Development Workflow
```bash
# Terminal 1: Start mock server
pnpm run start:server

# Terminal 2: Start CLI interface  
pnpm run start:cli
```

### Critical Rules (ALWAYS FOLLOW)
- **Use `pnpm`** - Never use `npm` or `yarn`
- **No barrel files** - Keep imports direct and explicit
- **No centralized `types.ts`** - Define types beside functions
- **Use explicit `.ts`/`.tsx` extensions** in imports (ES modules requirement)
- **Never run interactive CLI commands** when working on interface improvements

### Key Navigation
- **Server**: `src/server/` directory - API endpoints, storage, types
- **CLI**: `src/components/` directory - React components for interface
- **Scripts**: Check [package.json](mdc:package.json) for available commands
- **Port**: Mock server runs on port 3010 (not 3001)

### Detailed Information
- Architecture & Components: [whatsapp-architecture.mdc](mdc:.cursor/rules/whatsapp-architecture.mdc)
- Development Guidelines: [whatsapp-development.mdc](mdc:.cursor/rules/whatsapp-development.mdc)
- Technology Stack: [whatsapp-tech-stack.mdc](mdc:.cursor/rules/whatsapp-tech-stack.mdc)
- Coding Conventions: [whatsapp-conventions.mdc](mdc:.cursor/rules/whatsapp-conventions.mdc)


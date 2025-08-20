# Task 3: Create Main CLI Entry Point with Brocli

## Overview
Create the new main CLI entry point at `src/index.ts` that uses Brocli for command routing. This will be the central entry point that handles both `server` and `tui` commands.

## Implementation Steps

1. **Create the main CLI entry point**
   Create `src/index.ts` with Brocli setup:

```typescript
#!/usr/bin/env node
import { defineCommand, type CommandDef } from '@drizzle-team/brocli'
import 'dotenv/config'

// Import command definitions (to be created in subsequent tasks)
import { serverCommand } from './commands/server.ts'
import { tuiCommand } from './commands/tui.ts'

// Main CLI definition
const cli = defineCommand({
  metadata: {
    name: 'whap',
    description: 'CLI and mock server for testing WhatsApp integration',
    version: '1.0.0',
  },
  subcommands: {
    server: serverCommand,
    tui: tuiCommand,
  },
})

// Execute CLI with error handling
async function main() {
  try {
    await cli.execute(process.argv.slice(2))
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...')
  process.exit(0)
})

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

main()
```

2. **Create commands directory structure**
   ```bash
   mkdir -p src/commands
   ```

3. **Plan command file structure**
   The command files will be created in subsequent tasks:
   - `src/commands/server.ts` - Server command implementation
   - `src/commands/tui.ts` - TUI command implementation

## Technical Requirements

- Use explicit `.ts` extensions for all imports (ES modules requirement)
- Include shebang `#!/usr/bin/env node` for executable behavior
- Maintain dotenv configuration loading
- Implement proper error handling and process signal management
- Follow Brocli's command definition patterns

## Brocli Command Structure

Each command will follow this pattern:
```typescript
import { defineCommand } from '@drizzle-team/brocli'

export const commandName = defineCommand({
  metadata: {
    name: 'command-name',
    description: 'Command description',
  },
  args: {
    // Command arguments if needed
  },
  handler: async (opts) => {
    // Command implementation
  },
})
```

## Expected Directory Structure After Changes

```
src/
├── index.ts               # New main CLI entry point
├── commands/              # New directory for command definitions
├── tui/
│   └── index.tsx         # Moved TUI entry point
├── components/
├── server/
└── utils/
```

## Features to Implement

1. **Command Routing**: Route `server` and `tui` commands to their respective implementations
2. **Help System**: Automatic help generation for commands and subcommands
3. **Error Handling**: Graceful error handling with user-friendly messages
4. **Signal Handling**: Proper SIGINT/SIGTERM handling for graceful shutdown
5. **Version Information**: Display version information when requested

## Notes

- This file will not be functional until the command files are created in subsequent tasks
- The version should match or be derived from package.json
- Error handling should be comprehensive but user-friendly
- Signal handling ensures graceful shutdown for both interactive and server modes

## Dependencies

- `@drizzle-team/brocli` (installed in Task 1)
- `dotenv` (existing dependency)

## Next Steps

After completion, proceed to:
- [Task 4: Implement server command](./task_4.md)
- [Task 5: Implement TUI command](./task_5.md)

## Completion Notes

**Completion Date:** 2025-08-20

**Implementation Summary:**
Created main CLI entry point at `src/index.ts` using Brocli with correct API. Created commands directory with placeholder server and TUI command files. Implemented proper signal handling and error management.

**Challenges Encountered:**
- Initial API mismatch - plan used `defineCommand` but actual Brocli API uses `command()` and `run()`
- Option definitions require proper builders like `string()` and `number()` instead of plain objects

**Lessons Learned:**
- Brocli uses `command()` and `run()` functions, not `defineCommand`
- Options must use builder functions: `string()`, `number()`, `boolean()`
- Help system works automatically with proper command structure

**Follow-up Items:**
- [x] Task completed successfully
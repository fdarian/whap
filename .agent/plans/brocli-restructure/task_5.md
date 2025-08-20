# Task 5: Implement TUI Command

## Overview
Create the `tui` command implementation that wraps the existing TUI functionality into a Brocli command. This command will start the interactive chat interface when users run `pnpm whap tui`.

## Implementation Steps

1. **Create the TUI command file**
   Create `src/commands/tui.ts`:

```typescript
import { defineCommand } from '@drizzle-team/brocli'
import { render } from 'ink'
import { WhatsAppTestCLI } from '../components/WhatsAppTestCLI.tsx'
import { getTerminalInfo } from '../utils/terminal.ts'

export const tuiCommand = defineCommand({
  metadata: {
    name: 'tui',
    description: 'Start the interactive WhatsApp test interface',
  },
  args: {
    server: {
      type: 'string',
      description: 'Mock server URL to connect to',
      default: 'http://localhost:3010',
      alias: 's',
    },
  },
  handler: async (opts) => {
    console.log('🚀 Starting WhatsApp Test CLI...')
    
    // Set server URL from command line argument
    if (opts.args.server) {
      process.env.WHAP_SERVER_URL = opts.args.server
    }

    // Check terminal compatibility and provide helpful information
    const terminalInfo = getTerminalInfo()
    
    if (terminalInfo.isWarp) {
      // Warp terminal specific optimizations
      process.env.FORCE_COLOR = '1'
    }

    // Provide terminal compatibility information
    if (!terminalInfo.supportsUnicode) {
      console.warn('⚠️  Your terminal may not fully support Unicode characters.')
      console.warn('   Consider using a modern terminal for the best experience.')
    }

    if (!terminalInfo.supportsColor) {
      console.warn('⚠️  Color support is limited in your terminal.')
    }

    // Start the CLI application with error handling
    try {
      console.log('Starting interactive interface...')
      
      const { unmount } = render(<WhatsAppTestCLI />)

      // Handle graceful shutdown
      const gracefulShutdown = () => {
        console.log('\n⏹️  Shutting down CLI gracefully...')
        unmount()
        console.log('✅ CLI shut down successfully')
        process.exit(0)
      }

      // Signal handlers (these will coordinate with main CLI handlers)
      process.on('SIGINT', gracefulShutdown)
      process.on('SIGTERM', gracefulShutdown)
      
      // Handle normal exit
      process.on('exit', () => {
        unmount()
      })

      console.log('✅ Interactive interface started successfully')
      console.log('Press Ctrl+C to exit')

    } catch (error) {
      console.error('❌ Failed to start WhatsApp Test CLI:', error)
      
      // Provide helpful error information
      if (error instanceof Error) {
        if (error.message.includes('TTY')) {
          console.error('   This appears to be a terminal compatibility issue.')
          console.error('   Try running in a different terminal or check TTY support.')
        } else if (error.message.includes('TERM')) {
          console.error('   Terminal environment variable may not be set correctly.')
          console.error('   Try setting TERM=xterm-256color')
        }
      }
      
      throw error
    }
  },
})
```

2. **Update TUI component imports (if needed)**
   Verify that `src/tui/index.tsx` is no longer needed since we're importing the TUI functionality directly into the command.

3. **Consider creating a shared TUI launcher**
   If the TUI logic becomes complex, consider extracting it to `src/tui/launcher.ts`:

```typescript
// src/tui/launcher.ts (optional, if needed for complexity management)
import { render } from 'ink'
import { WhatsAppTestCLI } from '../components/WhatsAppTestCLI.tsx'
import { getTerminalInfo } from '../utils/terminal.ts'

export interface TUILauncherOptions {
  serverUrl?: string
}

export async function launchTUI(options: TUILauncherOptions = {}): Promise<void> {
  // Set server URL if provided
  if (options.serverUrl) {
    process.env.WHAP_SERVER_URL = options.serverUrl
  }

  // Terminal compatibility setup
  const terminalInfo = getTerminalInfo()
  
  if (terminalInfo.isWarp) {
    process.env.FORCE_COLOR = '1'
  }

  // Start the React application
  const { unmount } = render(<WhatsAppTestCLI />)

  // Return unmount function for cleanup
  return new Promise((resolve) => {
    const gracefulShutdown = () => {
      unmount()
      resolve()
    }

    process.on('SIGINT', gracefulShutdown)
    process.on('SIGTERM', gracefulShutdown)
    process.on('exit', gracefulShutdown)
  })
}
```

## Technical Requirements

- **Preserve Functionality**: All existing TUI functionality must work identically
- **Server URL Configuration**: Support command-line argument for server URL
- **Terminal Compatibility**: Maintain existing terminal compatibility checks
- **Error Handling**: Comprehensive error handling with helpful messages
- **Signal Handling**: Proper coordination with main CLI signal handlers
- **React/Ink Integration**: Preserve existing React component structure

## Command Features

1. **Server URL Argument**: `--server` or `-s` to specify mock server URL
2. **Terminal Detection**: Automatic terminal compatibility detection
3. **Graceful Shutdown**: Clean shutdown on interrupt signals
4. **Error Recovery**: Helpful error messages for common TUI issues
5. **Startup Feedback**: Clear indication of startup progress

## Usage Examples

```bash
# Start TUI with default server
pnpm whap tui

# Start TUI with custom server URL
pnpm whap tui --server http://localhost:8080
pnpm whap tui -s http://localhost:8080

# Get help
pnpm whap tui --help
```

## Expected Console Output

```
🚀 Starting WhatsApp Test CLI...
Starting interactive interface...
✅ Interactive interface started successfully
Press Ctrl+C to exit
[TUI interface appears]
```

## Error Handling Scenarios

1. **Terminal Compatibility Issues**:
   ```
   ❌ Failed to start WhatsApp Test CLI: TTY not available
      This appears to be a terminal compatibility issue.
      Try running in a different terminal or check TTY support.
   ```

2. **Server Connection Issues**:
   ```
   ⚠️  Cannot connect to server at http://localhost:3010
      Make sure the server is running with: pnpm whap server
   ```

## Validation Steps

1. **TUI starts correctly**:
   ```bash
   pnpm whap tui
   ```

2. **Custom server URL works**:
   ```bash
   pnpm whap tui --server http://localhost:8080
   ```

3. **Terminal compatibility works**: Test in different terminal environments

4. **Graceful shutdown works**: Test Ctrl+C interruption

5. **Error handling works**: Test with server unavailable

## File Structure Options

### Option A: Direct Implementation (Simpler)
- Implement all logic directly in `src/commands/tui.ts`
- Remove `src/tui/index.tsx` since it's no longer needed

### Option B: Extracted Launcher (More Organized)
- Create `src/tui/launcher.ts` for TUI logic
- Keep `src/commands/tui.ts` focused on command definition
- This approach is better if TUI logic becomes complex

## Notes

- The original `src/tui/index.tsx` may no longer be needed after this implementation
- Signal handling should coordinate with the main CLI without conflicts
- Environment variable setting for server URL provides flexibility
- Terminal compatibility checks ensure good user experience across different environments

## Dependencies

- React and Ink (existing dependencies)
- Terminal utilities (existing)
- Brocli for command definition

## Next Steps

After completion, proceed to [Task 6: Update package.json with bin field and scripts](./task_6.md)

## Completion Notes
<!-- Fill out this section when the task is completed -->

**Completion Date:** [Date]

**Implementation Summary:**
[Brief summary of what was implemented]

**Challenges Encountered:**
- [Challenge 1]
- [Challenge 2]

**Lessons Learned:**
- [Lesson 1]
- [Lesson 2]

**Follow-up Items:**
- [ ] [Any follow-up task 1]
- [ ] [Any follow-up task 2]
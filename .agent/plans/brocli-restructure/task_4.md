# Task 4: Implement Server Command

## Overview
Create the `server` command implementation that wraps the existing server functionality into a Brocli command. This command will start the WhatsApp mock server when users run `pnpm whap server`.

## Implementation Steps

1. **Create the server command file**
   Create `src/commands/server.ts`:

```typescript
import { defineCommand } from '@drizzle-team/brocli'
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { getWebhookConfig } from '../server/config.ts'
import { conversationRouter } from '../server/routes/conversation.ts'
import { messagesRouter } from '../server/routes/messages.ts'
import { statusRouter } from '../server/routes/status.ts'
import { templatesRouter } from '../server/routes/templates.ts'
import { webhooksRouter } from '../server/routes/webhooks.ts'
import { templateStore } from '../server/store/template-store.ts'
import { addClient, removeClient } from '../server/websocket.ts'

export const serverCommand = defineCommand({
  metadata: {
    name: 'server',
    description: 'Start the WhatsApp mock server',
  },
  args: {
    port: {
      type: 'number',
      description: 'Port to run the server on',
      default: 3010,
      alias: 'p',
    },
  },
  handler: async (opts) => {
    const PORT = opts.args.port || Number(process.env.PORT) || 3010

    console.log('🚀 Starting WhatsApp Mock Server...')
    
    // Initialize webhook configuration
    getWebhookConfig()

    // Initialize template store with hot-reload
    try {
      await templateStore.initialize()
      console.log('✅ Template store initialized')
    } catch (error) {
      console.error('❌ Failed to initialize template store:', error)
      throw error
    }

    // Create Hono app with all the existing configuration
    const app = createServerApp()

    // Start the server
    const server = serve({
      fetch: app.fetch,
      port: PORT,
    })

    // Inject WebSocket support
    const { injectWebSocket } = createNodeWebSocket({ app })
    injectWebSocket(server)

    console.log(`🚀 Server is running on port ${PORT}`)
    console.log(`🔌 WebSocket server is running on ws://localhost:${PORT}/ws`)
    console.log(`🏥 Health check: http://localhost:${PORT}/health`)
    console.log('Press Ctrl+C to stop the server')

    // Handle graceful shutdown
    const gracefulShutdown = () => {
      console.log('\n⏹️  Shutting down server gracefully...')
      server.close(() => {
        console.log('✅ Server shut down successfully')
        process.exit(0)
      })
    }

    process.on('SIGINT', gracefulShutdown)
    process.on('SIGTERM', gracefulShutdown)

    return server
  },
})

// Extract server creation logic to avoid duplication
function createServerApp(): Hono {
  const app = new Hono()
  const { upgradeWebSocket } = createNodeWebSocket({ app })

  // Middleware
  app.use('*', cors())
  app.use('*', logger())

  // Custom logging middleware for request bodies
  app.use('*', async (c, next) => {
    const method = c.req.method
    const path = c.req.path
    console.log(`[${new Date().toISOString()}] ${method} ${path}`)

    // Log headers
    const headerEntries = Object.entries(c.req.header())
    console.log('Headers:', Object.fromEntries(headerEntries))

    // Log body for POST/PUT requests
    if (method === 'POST' || method === 'PUT') {
      try {
        const clone = c.req.raw.clone()
        const bodyText = await clone.text()
        console.log('Body:', bodyText)
      } catch {
        // Body might not be readable, that's okay
      }
    }

    await next()
  })

  // Routes
  app.get('/health', (c) =>
    c.json({
      ok: true,
      message: 'Server is healthy',
      templates: templateStore.getStats(),
    })
  )

  // Debug endpoints (only in development)
  if (process.env.NODE_ENV !== 'production') {
    app.get('/debug/templates', (c) =>
      c.json({
        stats: templateStore.getStats(),
        templates: templateStore.getAllTemplates(),
        templateNames: templateStore.getTemplateNames(),
      })
    )

    app.post('/debug/reload-templates', async (c) => {
      try {
        await templateStore.reloadTemplates()
        return c.json({
          success: true,
          message: 'Templates reloaded successfully',
          stats: templateStore.getStats(),
        })
      } catch (error) {
        return c.json(
          {
            success: false,
            message: 'Failed to reload templates',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        )
      }
    })
  }

  // API routes
  app.route('/v22.0', messagesRouter)
  app.route('/v22.0', templatesRouter)
  app.route('/mock', webhooksRouter)
  app.route('/status', statusRouter)
  app.route('/conversation', conversationRouter)
  app.route('/webhook', webhooksRouter)

  // WebSocket endpoint
  app.get(
    '/ws',
    upgradeWebSocket((c) => {
      return {
        onOpen: (_evt, ws) => {
          console.log('WebSocket connection opened')
          // biome-ignore lint/suspicious/noExplicitAny: existing code pattern
          addClient(ws as any)
        },
        onClose: (_evt, ws) => {
          console.log('WebSocket connection closed')
          // biome-ignore lint/suspicious/noExplicitAny: existing code pattern
          removeClient(ws as any)
        },
        onError: (err, ws) => {
          console.error('WebSocket error:', err)
          // biome-ignore lint/suspicious/noExplicitAny: existing code pattern
          removeClient(ws as any)
        },
      }
    })
  )

  // 404 handler
  app.notFound((c) => {
    return c.json(
      {
        error: {
          message: `WhatsApp Mock Server: Route ${c.req.method} ${c.req.path} not found`,
          type: 'not_found',
          code: 404,
        },
      },
      404
    )
  })

  // Error handler
  app.onError((err, c) => {
    console.error('Error:', err)
    return c.json(
      {
        error: {
          message: 'Internal server error',
          type: 'server_error',
          code: 500,
        },
      },
      500
    )
  })

  return app
}
```

## Technical Requirements

- **Preserve Functionality**: All existing server functionality must work identically
- **Port Configuration**: Support both command-line argument and environment variable
- **Error Handling**: Proper error handling for server startup failures
- **Graceful Shutdown**: Handle SIGINT/SIGTERM for clean shutdown
- **Logging**: Maintain existing logging behavior and user feedback
- **WebSocket Support**: Ensure WebSocket functionality is preserved

## Command Features

1. **Port Argument**: `--port` or `-p` to specify server port
2. **Environment Variables**: Respect existing `PORT` environment variable
3. **Startup Messages**: Clear feedback about server status and endpoints
4. **Graceful Shutdown**: Clean shutdown on interrupt signals
5. **Error Recovery**: Helpful error messages for common startup issues

## Usage Examples

```bash
# Start server on default port (3010)
pnpm whap server

# Start server on custom port
pnpm whap server --port 8080
pnpm whap server -p 8080

# With environment variable
PORT=8080 pnpm whap server

# Get help
pnpm whap server --help
```

## Expected Console Output

```
🚀 Starting WhatsApp Mock Server...
✅ Template store initialized
🚀 Server is running on port 3010
🔌 WebSocket server is running on ws://localhost:3010/ws
🏥 Health check: http://localhost:3010/health
Press Ctrl+C to stop the server
```

## Validation Steps

1. **Server starts correctly**:
   ```bash
   pnpm whap server
   ```

2. **Health check works**:
   ```bash
   curl http://localhost:3010/health
   ```

3. **Custom port works**:
   ```bash
   pnpm whap server --port 8080
   curl http://localhost:8080/health
   ```

4. **Graceful shutdown works**: Test Ctrl+C interruption

## Notes

- This command extracts and wraps the existing server logic from `src/server/server.ts`
- All imports use explicit `.ts` extensions for ES modules compatibility
- The original `src/server/server.ts` file will remain but won't be used as an entry point
- Signal handling is coordinated with the main CLI entry point

## Dependencies

- All existing server dependencies (Hono, WebSocket support, etc.)
- Brocli for command definition

## Next Steps

After completion, proceed to [Task 5: Implement TUI command](./task_5.md)

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
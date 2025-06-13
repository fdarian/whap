# CLAUDE.md - WhatsApp Mock Server Development Tool

## Project Overview

This is a **WhatsApp Mock Server Development Tool** - a comprehensive development environment for testing WhatsApp integrations without using real WhatsApp Cloud API endpoints, phone numbers, or incurring API costs.

### Key Purpose
- **Development Speed**: Test WhatsApp flows without API rate limits or real phone numbers
- **Cost Efficiency**: Zero API charges during development and testing
- **Offline Development**: Work on WhatsApp features without internet connectivity
- **Integration Testing**: Simulate various webhook scenarios and edge cases
- **Seamless Switching**: Toggle between mock and real APIs via environment variables

## Quick Start

```bash
# Terminal 1: Start mock server
pnpm run start:server

# Terminal 2: Start CLI interface
pnpm run start:cli
```

## Architecture Overview

The project consists of two main components:

### 1. Mock Server (src/server/)
- **Hono-based server** that mimics WhatsApp Cloud API endpoints
- **In-memory storage** for messages and conversation state
- **Webhook simulation** capabilities
- **Full API compatibility** with WhatsApp Cloud API v22.0

### 2. Interactive CLI (src/components/)
- **React-based CLI** built with Ink framework
- **Real-time monitoring** of webhooks and messages
- **Interactive message composition** and testing
- **Simplified interface** with onboarding flow

## Critical Files

### Entry Points
- `src/index.tsx` - CLI application entry
- `src/server/server.ts` - Mock server entry

### Core CLI Components
- `src/components/WhatsAppTestCLI.tsx` - Main app with simplified layout
- `src/components/OnboardingFlow.tsx` - Initial phone number setup
- `src/components/SimplifiedChatInterface.tsx` - Main conversation interface
- `src/components/TextInput.tsx` - Reusable text input component

### Server Architecture
- `src/server/routes/` - API endpoint handlers
- `src/server/store/` - In-memory data storage
- `src/server/types/` - API type definitions

## Coding Standards & Conventions

### TypeScript Specific (CRITICAL)
- **Do not create barrel files** - Keep imports direct and explicit
- **Do not organize types into one `types.ts`** - Define types beside functions in the same module, or use inference when possible
- **Use explicit `.ts` (or `.tsx`) extensions** in imports (required for ES modules)

```typescript
// ✅ Correct - explicit .ts extension
import { ApiClient } from '../utils/api-client.ts'

// ✅ Correct - direct imports, no barrel files
import { MessageComposer } from './MessageComposer.tsx'

// ✅ Correct - inline type definitions
export interface MessageData {
  id: string
  content: string
  timestamp: Date
}
```

### General Development
- **When modifying functions that become too large** - Refactor modifications into separate functions to enhance readability
- **Comment only when necessary** - Comment when the change's intent or rationale is not self-evident from the diff
- **Use `pnpm` for all package management** - Never use `npm` or `yarn`

## Environment Configuration

Create/update `.env` file:
```bash
# Use mock server for development (recommended)
PORT=http://localhost:3010

# Or use real WhatsApp API for production testing
# PORT=https://graph.facebook.com
```

## Development Workflow

### Two-Process Development
Always run server (`pnpm run start:server`) + CLI (`pnpm run start:cli`) in separate terminals

### CLI Navigation
- **Enter**: Send message / advance onboarding steps
- **Ctrl+N**: Start new conversation (reset phone numbers)
- **Ctrl+R**: Refresh conversation manually
- **Ctrl+C**: Exit application
- **Esc**: Go back one step (during onboarding)

### Interface Design
1. **Header Area**: Connection status, user/bot phone numbers, keyboard shortcuts
2. **Main Content Area**: Conversation history (auto-updating, newest first)
3. **Input Area**: Message composition with send status

## API Compatibility

### WhatsApp Cloud API Compatible Endpoints
- `POST /v22.0/{phone-number-id}/messages` - Send messages (text, templates)
- `GET /health` - Server health check

### Mock Server Specific Endpoints
- `POST /mock/webhooks/trigger` - Trigger webhook events
- `GET /mock/webhooks/config` - Get webhook configuration
- `PUT /mock/webhooks/config` - Update webhook configuration
- `GET /conversation` - Get conversation history

### WhatsApp Message Structure
```typescript
// Standard WhatsApp webhook payload structure
{
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      messaging_product: 'whatsapp',
      messages: [{
        from: '6286777363432',
        id: 'message_id',
        timestamp: '1234567890',
        type: 'text',
        text: { body: 'Message content' }
      }]
    }]
  }]
}
```

## Dependencies & Tech Stack

### Core Technologies
- **Bun** with ES modules (`"type": "module"` in package.json)
- **TypeScript** with strict configuration
- **TSX** for running TypeScript files directly

### Server Framework
- **Hono** - Lightweight web framework for the mock server

### CLI Framework
- **React** - Component-based UI library
- **Ink** - React renderer for CLI applications

### HTTP & Utilities
- **ky** - HTTP client for API communication
- **chalk** - Terminal string styling
- **dotenv** - Environment variable loading
- **date-fns** - Date manipulation utilities
- **uuid** - UUID generation

## Key Patterns & Conventions

### React/Ink Patterns
```typescript
// ✅ Functional components with hooks
export const Component = () => {
  const [state, setState] = useState()

  useInput((input, key) => {
    // Handle keyboard input
  })

  useEffect(() => {
    // Handle side effects
  })

  return <Box>...</Box>
}
```

### Server Patterns
```typescript
// ✅ Hono route handlers
app.post('/v22.0/:phoneId/messages', async (c) => {
  return c.json({
    messaging_product: 'whatsapp',
    messages: [{ id: uuid() }]
  })
})

// ✅ WhatsApp-compatible error responses
return c.json({
  error: {
    message: 'Descriptive error message',
    type: 'error_type',
    code: 400
  }
}, 400)
```

## CLI Interface Development Guidelines

### ❌ Don't Do This
- **Never run `pnpm run start:cli`** or similar interactive commands when working on interface improvements
- Interactive CLI commands don't provide useful feedback in this development context

### ✅ Do This Instead
- Focus on making code changes and explaining expected behavior
- Analyze the code structure and layout logic
- Use static analysis to predict how changes will affect the interface

### Message Interface Best Practices
- **Fixed message limits** instead of dynamic calculations based on terminal size
- **Single-line compact format** that won't wrap: `14:05:20 → ...313111 hi there`
- **Smart truncation**: Show last 6 digits of phone numbers, limit message text to 20 chars
- **No complex nested layouts** - use simple Box + Text combinations

## Common Gotchas

### ❌ Don't Do This
- **Never use npm/yarn** - Always use `pnpm`
- **Don't create barrel files** - Keep imports explicit
- **Don't centralize types** - Define them inline or beside functions
- **Don't run interactive CLI commands in background** - They don't provide useful feedback
- **Don't assume port 3001** - Default mock server runs on port 3010

### ✅ Always Do This
- **Check package.json scripts** before running commands
- **Use explicit .ts extensions** in imports (ES modules requirement)
- **Maintain WhatsApp API compatibility** when adding/modifying endpoints
- **Update CLI status/feedback** when adding new features
- **Test both mock and API switching** when making server changes

## Memory-Worthy Patterns

### Development Workflow
1. **Start server**: `pnpm run start:server` (terminal 1)
2. **Start CLI**: `pnpm run start:cli` (terminal 2)
3. **Test cycle**: Compose → Send → Monitor webhooks → Verify conversation
4. **API switching**: Change `PORT` in `.env` to switch between mock/real API

### Debugging Context
- **Server logs**: Check terminal running `start:server` for API call logs
- **CLI state**: All state is visual in the CLI interface
- **Memory store**: Data clears on server restart (in-memory only)
- **Port conflicts**: Default server port is 3010, not 3001

## When Adding Features

1. **Consider both CLI and API impact** - Most features touch both
2. **Update relevant rule files** in `.cursor/rules/` to maintain context
3. **Test the full workflow** - Compose → Send → Monitor → Respond
4. **Maintain visual feedback** - Users should see what's happening
5. **Keep API compatibility** - New features shouldn't break WhatsApp Cloud API structure

## Vibe-Coding Context

This project is designed for rapid development and testing of WhatsApp integrations. When working on this project:

1. **Understand the dual nature**: Mock server for development, real API for production
2. **Focus on developer experience**: Everything should be fast, visual, and easy to test
3. **Maintain API compatibility**: Changes should preserve WhatsApp Cloud API v22.0 compatibility
4. **Think in terms of workflows**: Compose → Send → Monitor → Respond cycle
5. **Mock-First Philosophy**: Default to mock server (localhost:3010), switch to real API only when needed
6. **Visual Feedback Loop**: Everything should be visible in the CLI - no blind API calls

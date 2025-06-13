# Whap

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/fdarian/whap?utm_source=oss&utm_medium=github&utm_campaign=fdarian%2Fwhap&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

A comprehensive development environment for testing WhatsApp integrations without using real WhatsApp Cloud API endpoints, phone numbers, or incurring API costs.

## Features

### 🚀 Mock Server Features
- **Full API Compatibility**: Mimics WhatsApp Cloud API endpoints for seamless integration testing
- **Message Sending & Receiving**: Complete message flow simulation with realistic responses
- **Webhook Simulation**: Real-time webhook events for message delivery status, read receipts, and error handling
- **Template Management API**: Full CRUD operations for WhatsApp message templates
- **Hot-Reload Templates**: Automatic template reloading when JSON files change - no server restart required
- **Schema Validation**: Ensures templates comply with WhatsApp Business API requirements
- **Zero Cost Testing**: Test without real phone numbers, API charges, or rate limits
- **Persistent Storage**: In-memory conversation and template storage for development sessions

### 🖥️ Interactive CLI Features
- **Real-time Testing Interface**: React-based CLI for interactive message and template testing
- **Template Browser**: Easy template selection and preview with category filtering
- **Variable Input System**: Guided prompts for template parameter collection with validation
- **Conversation History**: View complete message and template history with timestamps
- **Development Workflow**: Seamless integration with existing development processes
- **Hot-Reload Integration**: Instantly test template changes without restarting CLI

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/fdarian/whap.git
cd whap

# Install dependencies
pnpm install
```

### Basic Usage

```bash
# Terminal 1: Start the mock server
pnpm run start:server

# Terminal 2: Start the CLI interface
pnpm run start:cli
```

The mock server runs on port **3010** and provides WhatsApp Cloud API compatible endpoints.

## Template System

### Quick Template Setup

1. **Create template files** in the `templates/` directory:
   ```json
   // templates/welcome.json
   {
     "name": "welcome_message",
     "category": "UTILITY",
     "language": "en_US",
     "components": [
       {
         "type": "BODY",
         "text": "Welcome {{1}}! Your account has been created successfully.",
         "example": {
           "body_text": [["John Doe"]]
         }
       }
     ]
   }
   ```

2. **Templates auto-load** - no restart required!
3. **Test via CLI** - select templates and enter variables interactively
4. **Send via API** - use standard WhatsApp Business API format

### Template Development Workflow

```bash
# 1. Create/modify template files in templates/
# 2. Templates hot-reload automatically  
# 3. Test immediately in CLI interface
# 4. Send via API for integration testing
```

### API Example

```bash
curl -X POST http://localhost:3010/v22.0/123456789/messages \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890", 
    "type": "template",
    "template": {
      "name": "welcome_message",
      "language": { "code": "en_US" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "John Doe" }
          ]
        }
      ]
    }
  }'
```

📚 **[Complete Template Documentation →](docs/templates.md)**

## Development

### Available Scripts

```bash
# Development
pnpm run start:server     # Start mock server (port 3010)
pnpm run start:cli        # Start interactive CLI
pnpm run dev              # Start both in development mode

# Testing  
pnpm run test             # Run test suite
pnpm run test:watch       # Run tests in watch mode

# Building
pnpm run build            # Build for production
```

### Project Structure

```
whap/
├── templates/                    # Template JSON files
├── src/
│   ├── server/                   # Mock server implementation
│   │   ├── routes/
│   │   │   ├── messages.ts       # Message sending (includes templates)
│   │   │   └── templates.ts      # Template management API
│   │   └── stores/
│   │       └── template-store.ts # Template storage & validation
│   └── components/               # CLI interface
│       └── SimplifiedChatInterface.tsx
├── docs/
│   └── templates.md              # Complete template documentation
└── package.json
```

## Key Features

- **Zero Configuration**: Works out-of-the-box with no setup required
- **Hot-Reload**: Templates update instantly during development
- **Full API Compatibility**: Drop-in replacement for WhatsApp Cloud API
- **Interactive Testing**: CLI-based template and message testing
- **Schema Validation**: Ensures templates meet WhatsApp requirements
- **Webhook Simulation**: Complete delivery status event simulation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

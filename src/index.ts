import { command, run } from '@drizzle-team/brocli'
import 'dotenv/config'

// Import commands
import { serverCommand } from './commands/server.ts'
import { tuiCommand } from './commands/tui.ts'

// Signal handlers for graceful shutdown
process.on('SIGINT', () => {
	console.log('\nReceived SIGINT. Gracefully shutting down...')
	process.exit(0)
})

process.on('SIGTERM', () => {
	console.log('\nReceived SIGTERM. Gracefully shutting down...')
	process.exit(0)
})

// Run the CLI
run([serverCommand, tuiCommand], {
	name: 'whap',
	description: 'WhatsApp Mock Server Development Tool',
	version: '1.0.0',
})

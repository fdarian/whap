#!/usr/bin/env node
import { render } from 'ink'
import { WhatsAppTestCLI } from '../components/WhatsAppTestCLI.tsx'
import { getTerminalInfo } from '../utils/terminal.ts'
import 'dotenv/config'

// Check terminal compatibility and provide helpful information
const terminalInfo = getTerminalInfo()

// Handle terminal-specific setup
if (terminalInfo.isWarp) {
	// Warp terminal specific optimizations
	process.env.FORCE_COLOR = '1'
}

// Ensure proper cleanup on exit
process.on('SIGINT', () => {
	process.exit(0)
})

process.on('SIGTERM', () => {
	process.exit(0)
})

// Start the CLI application with error handling
try {
	const { unmount } = render(<WhatsAppTestCLI />)

	// Handle graceful shutdown
	process.on('exit', () => {
		unmount()
	})
} catch (error) {
	console.error('Failed to start WhatsApp Test CLI:', error)
	process.exit(1)
}

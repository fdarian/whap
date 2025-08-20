#!/usr/bin/env node
import { render } from 'ink'
import { WhatsAppTestCLI } from '../components/WhatsAppTestCLI.tsx'
import { getTerminalInfo } from '../utils/terminal.ts'
import 'dotenv/config'

export interface StartTUIOptions {
	serverUrl?: string
}

export function startTUI(options: StartTUIOptions = {}) {
	// Check terminal compatibility and provide helpful information
	const terminalInfo = getTerminalInfo()

	// Handle terminal-specific setup
	if (terminalInfo.isWarp) {
		// Warp terminal specific optimizations
		process.env.FORCE_COLOR = '1'
	}

	// Ensure proper cleanup on exit
	const handleExit = () => {
		process.exit(0)
	}

	process.on('SIGINT', handleExit)
	process.on('SIGTERM', handleExit)

	// Start the CLI application with error handling
	try {
		const { unmount } = render(
			<WhatsAppTestCLI serverUrl={options.serverUrl} />
		)

		// Handle graceful shutdown
		const cleanup = () => {
			unmount()
		}

		process.on('exit', cleanup)

		return { unmount: cleanup }
	} catch (error) {
		console.error('Failed to start WhatsApp Test CLI:', error)
		throw error
	}
}

// If this file is run directly, start the TUI
if (import.meta.url === `file://${process.argv[1]}`) {
	startTUI()
}

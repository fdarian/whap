import { render } from 'ink'
import { createElement } from 'react'
import { WhatsAppTestCLI } from './components/WhatsAppTestCLI.tsx'
import { getTerminalInfo } from './utils/terminal.ts'
import 'dotenv/config'

// Bun + Ink compatibility fix: Resume stdin to prevent immediate exit
if (typeof Bun !== 'undefined') {
	process.stdin.resume()
}

// Check terminal compatibility and provide helpful information
const terminalInfo = getTerminalInfo()

// Handle terminal-specific setup
if (terminalInfo.isWarp) {
	// Warp terminal specific optimizations
	process.env.FORCE_COLOR = '1'
}

// Terminal cursor restoration on exit (important for Bun)
const restoreTerminalCursor = () => {
	const terminal = process.stderr.isTTY
		? process.stderr
		: process.stdout.isTTY
			? process.stdout
			: undefined
	terminal?.write('\u001B[?25h') // Show cursor
}

let app: { unmount: () => void; waitUntilExit: () => Promise<void> } | null =
	null

// Graceful cleanup function
const cleanup = () => {
	if (app) {
		app.unmount()
		app = null
	}
	restoreTerminalCursor()
}

// Handle various exit scenarios
process.on('SIGINT', () => {
	cleanup()
	process.exit(0)
})

process.on('SIGTERM', () => {
	cleanup()
	process.exit(0)
})

process.on('exit', () => {
	cleanup()
})

// Start the CLI application with error handling
const startApp = async () => {
	try {
		// Use createElement explicitly to avoid JSX issues with Bun
		app = render(createElement(WhatsAppTestCLI))

		// Wait for the app to exit naturally and then cleanup
		await app.waitUntilExit()
		cleanup()
		process.exit(0)
	} catch (error) {
		console.error('Failed to start WhatsApp Test CLI:', error)
		cleanup()
		process.exit(1)
	}
}

// Start the application
startApp()

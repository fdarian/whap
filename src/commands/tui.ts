import { command, string } from '@drizzle-team/brocli'
import { startTUI } from '../tui/index.tsx'

export const tuiCommand = command({
	name: 'tui',
	desc: 'Start the interactive CLI interface',
	options: {
		serverUrl: string()
			.desc('URL of the mock server')
			.default('http://localhost:3010'),
	},
	handler: async (opts) => {
		try {
			console.log(`Starting TUI interface connecting to ${opts.serverUrl}`)
			startTUI({ serverUrl: opts.serverUrl })
		} catch (error) {
			console.error('Failed to start TUI interface:', error)
			process.exit(1)
		}
	},
})

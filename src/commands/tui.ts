import { command, string } from '@drizzle-team/brocli'

export const tuiCommand = command({
	name: 'tui',
	desc: 'Start the interactive CLI interface',
	options: {
		serverUrl: string()
			.desc('URL of the mock server')
			.default('http://localhost:3010'),
	},
	handler: async (opts) => {
		// TODO: Implement TUI command
		console.log(`Starting TUI interface connecting to ${opts.serverUrl}`)
	},
})

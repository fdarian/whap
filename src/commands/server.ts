import { command, number } from '@drizzle-team/brocli'

export const serverCommand = command({
	name: 'server',
	desc: 'Start the WhatsApp mock server',
	options: {
		port: number().desc('Port to run the server on').default(3010),
	},
	handler: async (opts) => {
		// TODO: Implement server command
		console.log(`Starting server on port ${opts.port}`)
	},
})

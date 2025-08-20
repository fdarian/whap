import { command, number } from '@drizzle-team/brocli'
import { startServer } from '../server/server.ts'

export const serverCommand = command({
	name: 'server',
	desc: 'Start the WhatsApp mock server',
	options: {
		port: number().desc('Port to run the server on').default(3010),
	},
	handler: async (opts) => {
		try {
			console.log('🚀 Starting WhatsApp Mock Server...')

			const server = await startServer(opts.port)

			// Handle graceful shutdown
			const gracefulShutdown = (exitCode = 0) => {
				console.log('\n⚡ Shutting down server gracefully...')
				server.close(() => {
					console.log('✅ Server closed successfully')
					process.exit(exitCode)
				})
			}

			// Register shutdown handlers
			process.on('SIGINT', gracefulShutdown)
			process.on('SIGTERM', gracefulShutdown)

			// Keep the process alive
			process.on('uncaughtException', (error) => {
				console.error('❌ Uncaught Exception:', error)
				gracefulShutdown(1)
			})

			process.on('unhandledRejection', (reason, promise) => {
				console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
				gracefulShutdown(1)
			})
		} catch (error) {
			console.error('❌ Failed to start server:', error)
			process.exit(1)
		}
	},
})

import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { stopStatsInterval } from '../server/routes/status.ts'
import { startServer } from '../server/server.ts'

export const serverCommand = Command.make(
	'server',
	{
		port: Flag.integer('port').pipe(
			Flag.withDefault(3010),
			Flag.withDescription('Port to run the server on')
		),
	},
	(opts) =>
		Effect.gen(function* () {
			console.log('🚀 Starting WhatsApp Mock Server...')

			const server = yield* Effect.tryPromise(() => startServer(opts.port))

			const gracefulShutdown = (exitCode = 0) => {
				console.log('\n⚡ Shutting down server gracefully...')
				stopStatsInterval()
				server.close(() => {
					console.log('✅ Server closed successfully')
					process.exit(exitCode)
				})
			}

			process.on('SIGINT', gracefulShutdown)
			process.on('SIGTERM', gracefulShutdown)

			process.on('uncaughtException', (error) => {
				console.error('❌ Uncaught Exception:', error)
				gracefulShutdown(1)
			})

			process.on('unhandledRejection', (reason, promise) => {
				console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
				gracefulShutdown(1)
			})

			return yield* Effect.never
		}).pipe(
			Effect.catch((error) =>
				Effect.sync(() => {
					console.error('❌ Failed to start server:', error)
					process.exit(1)
				})
			)
		)
).pipe(Command.withDescription('Start the WhatsApp mock server'))

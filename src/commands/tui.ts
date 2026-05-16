import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { startTUI } from '../tui/index.tsx'

export const tuiCommand = Command.make(
	'tui',
	{
		serverUrl: Flag.string('server-url').pipe(
			Flag.withDefault('http://localhost:3010'),
			Flag.withDescription('URL of the mock server')
		),
	},
	(opts) =>
		Effect.gen(function* () {
			console.log(`Starting TUI interface connecting to ${opts.serverUrl}`)

			yield* Effect.sync(() => startTUI({ serverUrl: opts.serverUrl }))

			process.on('uncaughtException', (error) => {
				console.error('❌ Uncaught Exception in TUI:', error)
				process.exit(1)
			})

			process.on('unhandledRejection', (reason, promise) => {
				console.error(
					'❌ Unhandled Rejection in TUI at:',
					promise,
					'reason:',
					reason
				)
				process.exit(1)
			})

			return yield* Effect.never
		}).pipe(
			Effect.catch((error) =>
				Effect.sync(() => {
					console.error('Failed to start TUI interface:', error)
					process.exit(1)
				})
			)
		)
).pipe(Command.withDescription('Start the interactive CLI interface'))

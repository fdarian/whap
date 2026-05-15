import 'dotenv/config'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { Command } from 'effect/unstable/cli'
import packageJson from '../package.json'
import { serverCommand } from './commands/server.ts'
import { tuiCommand } from './commands/tui.ts'

const whapCommand = Command.make('whap').pipe(
	Command.withDescription('WhatsApp Mock Server Development Tool'),
	Command.withSubcommands([serverCommand, tuiCommand])
)

Command.run(whapCommand, {
	version: packageJson.version,
}).pipe(Effect.provide(BunServices.layer), BunRuntime.runMain)

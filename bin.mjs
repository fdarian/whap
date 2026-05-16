#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const entry = resolve(dirname(fileURLToPath(import.meta.url)), 'src/index.ts')

try {
	execFileSync('bun', [entry, ...process.argv.slice(2)], { stdio: 'inherit' })
} catch (e) {
	if (e.code === 'ENOENT') {
		console.error(
			'Bun is required to run whap from source.\nInstall it from https://bun.sh/ and try again.'
		)
		process.exit(1)
	}
	process.exit(e.status ?? 1)
}

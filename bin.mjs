#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { arch, platform } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const require = createRequire(import.meta.url)

function runSource() {
	const entry = resolve(dirname(fileURLToPath(import.meta.url)), 'src/index.ts')
	try {
		execFileSync('bun', [entry, ...args], { stdio: 'inherit' })
	} catch (e) {
		process.exit(e.status ?? 1)
	}
	process.exit(0)
}

let bin
try {
	bin = require.resolve(`whap-${platform()}-${arch()}`)
} catch {
	runSource()
}

try {
	execFileSync(bin, args, { stdio: 'inherit' })
} catch (e) {
	if (e.status != null) {
		process.exit(e.status)
	}
	runSource()
}

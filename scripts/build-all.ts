import { compile } from './compile.ts'

const targets = [
	{ os: 'darwin', arch: 'arm64' },
	{ os: 'darwin', arch: 'x64' },
	{ os: 'linux', arch: 'arm64' },
	{ os: 'linux', arch: 'x64' },
] as const

for (const target of targets) {
	await compile(target)
}

console.log('All 4 binaries built successfully')

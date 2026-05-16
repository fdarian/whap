import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '..')

const platforms = [
	{ os: 'darwin', arch: 'arm64' },
	{ os: 'darwin', arch: 'x64' },
	{ os: 'linux', arch: 'arm64' },
	{ os: 'linux', arch: 'x64' },
]

for (const platform of platforms) {
	const target = `bun-${platform.os}-${platform.arch}`
	const outfile = join(repoRoot, `dist/whap-${platform.os}-${platform.arch}`)

	console.log(`Building for ${target}...`)

	const buildResult = Bun.spawn(
		[
			'bun',
			'build',
			'--compile',
			'--sourcemap',
			'--minify',
			`--target=${target}`,
			'src/index.ts',
			`--outfile=${outfile}`,
		],
		{
			cwd: repoRoot,
			stdout: 'inherit',
			stderr: 'inherit',
		}
	)

	await buildResult.exited

	if (buildResult.exitCode !== 0) {
		throw new Error(`Build failed for ${target}`)
	}
}

console.log('All 4 binaries built successfully')

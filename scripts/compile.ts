import { join } from 'node:path'

export async function compile(target: { os: string; arch: string }) {
	const repoRoot = join(import.meta.dir, '..')
	const outfile = join(repoRoot, `dist/whap-${target.os}-${target.arch}`)

	console.log(`Building for bun-${target.os}-${target.arch}...`)

	const result = Bun.spawn(
		[
			'bun',
			'build',
			'--compile',
			'--sourcemap',
			'--minify',
			`--target=bun-${target.os}-${target.arch}`,
			'src/index.ts',
			`--outfile=${outfile}`,
		],
		{
			cwd: repoRoot,
			stdout: 'inherit',
			stderr: 'inherit',
		}
	)

	await result.exited

	if (result.exitCode !== 0) {
		throw new Error(`Build failed for bun-${target.os}-${target.arch}`)
	}

	console.log(`Binary written to ${outfile}`)
}

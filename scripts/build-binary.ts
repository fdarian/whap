import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '..')

const target =
	process.argv
		.find((a) => a.startsWith('--target='))
		?.slice('--target='.length) ??
	process.env.BUILD_TARGET ??
	`${process.platform}-${process.arch}`

const os = target.split('-')[0]
const arch = target.split('-')[1]

const outfile = join(repoRoot, `dist/whap-${os}-${arch}`)

console.log(`Building for bun-${os}-${arch}...`)

const buildResult = Bun.spawn(
	[
		'bun',
		'build',
		'--compile',
		'--sourcemap',
		'--minify',
		`--target=bun-${os}-${arch}`,
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
	throw new Error(`Build failed for bun-${os}-${arch}`)
}

console.log(`Binary written to ${outfile}`)

import { chmodSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '..')

const packageJson = await Bun.file(join(repoRoot, 'package.json')).json()
const version = packageJson.version

const platforms = [
	{ os: 'darwin', arch: 'arm64' },
	{ os: 'darwin', arch: 'x64' },
	{ os: 'linux', arch: 'x64' },
	{ os: 'linux', arch: 'arm64' },
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
			'--bytecode',
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

	const pkgDir = join(repoRoot, `npm/whap-${platform.os}-${platform.arch}`)
	mkdirSync(pkgDir, { recursive: true })

	const platformPackageJson = {
		name: `whap-${platform.os}-${platform.arch}`,
		version,
		main: './bin',
		os: [platform.os],
		cpu: [platform.arch],
		files: ['bin'],
	}

	await Bun.write(
		join(pkgDir, 'package.json'),
		JSON.stringify(platformPackageJson, null, '\t') + '\n'
	)

	const binPath = join(pkgDir, 'bin')
	await Bun.write(binPath, Bun.file(outfile))
	chmodSync(binPath, 0o755)

	console.log(`Created ${pkgDir}`)
}

console.log('All platform packages built successfully')

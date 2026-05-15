import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '..')

const packageJsonPath = join(repoRoot, 'package.json')
const packageJson = await Bun.file(packageJsonPath).json()
const version = packageJson.version

if (packageJson.optionalDependencies) {
	for (const key in packageJson.optionalDependencies) {
		packageJson.optionalDependencies[key] = version
	}
}

await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, '\t') + '\n')

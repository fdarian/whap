import { compile } from './compile.ts'

const targetArg = process.argv
	.find((a) => a.startsWith('--target='))
	?.slice('--target='.length)

const targetStr =
	targetArg ?? process.env.BUILD_TARGET ?? `${process.platform}-${process.arch}`

const parts = targetStr.split('-')
const os = parts[0]
const arch = parts[1]

await compile({ os, arch })

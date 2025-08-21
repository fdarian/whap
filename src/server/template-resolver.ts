import { execSync } from 'node:child_process'
import type { Template } from './types/api-types.ts'

export class TemplateResolver {
	private command: string

	constructor(command: string) {
		this.command = command
	}

	resolveTemplate(name: string, language: string = 'en'): Template | null {
		try {
			console.log(
				`[TemplateResolver] Resolving template: ${name} (language: ${language})`
			)

			const args = [this.command, name, '--lang', language]
			const commandString = args.join(' ')

			console.log(`[TemplateResolver] Executing command: ${commandString}`)

			const output = execSync(commandString, {
				encoding: 'utf8',
				timeout: 30000, // 30 second timeout
				stdio: ['pipe', 'pipe', 'pipe'],
			})

			console.log(
				`[TemplateResolver] Command output received (${output.length} characters)`
			)

			if (!output.trim()) {
				console.warn(
					`[TemplateResolver] Empty output from command: ${commandString}`
				)
				return null
			}

			const template = JSON.parse(output.trim()) as Template

			// Basic validation of the parsed template
			if (!template.name || !Array.isArray(template.components)) {
				console.error(
					`[TemplateResolver] Invalid template structure: missing name or components`
				)
				return null
			}

			console.log(
				`[TemplateResolver] Successfully resolved template: ${template.name}`
			)
			return template
		} catch (error) {
			if (error instanceof SyntaxError) {
				console.error(
					`[TemplateResolver] Failed to parse JSON output for template '${name}':`,
					error.message
				)
			} else if (
				error &&
				typeof error === 'object' &&
				'status' in error &&
				'message' in error
			) {
				console.error(
					`[TemplateResolver] Command failed with exit code ${error.status} for template '${name}':`,
					error.message
				)
			} else {
				console.error(
					`[TemplateResolver] Unexpected error resolving template '${name}':`,
					error
				)
			}

			return null
		}
	}
}

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { FSWatcher } from 'chokidar'
import type {
	CreateTemplateRequest,
	Template,
	TemplateComponent,
	UpdateTemplateRequest,
} from '../types/api-types.ts'
import { validateTemplateData } from '../utils/validator.ts'

/** Auto-generate variables from template components */
function generateVariablesFromTemplate(
	components: TemplateComponent[]
): Record<string, { description: string; example: string }> {
	const variables: Record<string, { description: string; example: string }> = {}
	const variableRegex = /\{\{([^}]+)\}\}/g

	for (const component of components) {
		if (component.text) {
			const matches = component.text.matchAll(variableRegex)
			for (const match of matches) {
				const variableName = match[1].trim()

				if (!variables[variableName]) {
					// Generate description based on variable name
					const description = generateVariableDescription(variableName)
					const example = generateVariableExample(variableName)

					variables[variableName] = {
						description,
						example,
					}
				}
			}
		}
	}

	return variables
}

/** Generate a description for a variable based on its name */
function generateVariableDescription(variableName: string): string {
	// Handle numeric variables
	if (/^\d+$/.test(variableName)) {
		return `Parameter ${variableName}`
	}

	// Convert snake_case or camelCase to readable format
	const readable = variableName
		.replace(/_/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.replace(/\b\w/g, (l) => l.toUpperCase())

	return readable
}

/** Generate an example value for a variable based on its name */
function generateVariableExample(variableName: string): string {
	// Handle numeric variables
	if (/^\d+$/.test(variableName)) {
		return 'Example Value'
	}

	// Generate examples based on common patterns
	const lowerName = variableName.toLowerCase()

	if (lowerName.includes('name')) return 'John Doe'
	if (lowerName.includes('email')) return 'user@example.com'
	if (lowerName.includes('phone')) return '+1234567890'
	if (lowerName.includes('date')) return 'December 15, 2024'
	if (lowerName.includes('time')) return '2:30 PM'
	if (lowerName.includes('location') || lowerName.includes('address'))
		return 'New York, NY'
	if (lowerName.includes('event')) return 'Wedding Reception'
	if (lowerName.includes('company') || lowerName.includes('business'))
		return 'ABC Company'
	if (lowerName.includes('amount') || lowerName.includes('price'))
		return '$100.00'
	if (lowerName.includes('order') || lowerName.includes('id')) return '12345'

	return 'Example Value'
}

export class TemplateStore {
	private templates: Map<string, Template> = new Map()
	private watcher: FSWatcher | null = null
	private templatesDir: string
	private isWatching = false

	constructor(templatesDir = './templates') {
		// Resolve to absolute path to ensure consistent file watching
		this.templatesDir = join(process.cwd(), templatesDir)
	}

	/** Initialize the template store and start file watching */
	async initialize(): Promise<void> {
		console.log('🗂️  Initializing template store...')

		// Load existing templates
		await this.loadAllTemplates()

		// Start file watcher
		this.startWatcher()

		console.log(
			`📁 Template store initialized with ${this.templates.size} templates`
		)
	}

	/** Start file watcher for hot-reload functionality */
	private startWatcher(): void {
		if (this.isWatching) {
			return
		}

		// Watch the entire directory instead of just pattern matching
		console.log(
			`🔍 Setting up file watcher for directory: ${this.templatesDir}`
		)

		// Dynamic import chokidar to fix type issues
		import('chokidar').then((chokidarModule) => {
			this.watcher = chokidarModule.default.watch(this.templatesDir, {
				ignored: /^\./,
				persistent: true,
				ignoreInitial: true,
				depth: 0, // Only watch direct files, not subdirectories
				awaitWriteFinish: {
					stabilityThreshold: 100,
					pollInterval: 50,
				},
			})

			if (this.watcher) {
				this.watcher
					.on('add', async (path: string) => {
						if (path.endsWith('.json')) {
							console.log(`📄 Template file added: ${path}`)
							await this.loadTemplate(path)
						}
					})
					.on('change', async (path: string) => {
						if (path.endsWith('.json')) {
							console.log(`📝 Template file changed: ${path}`)
							await this.loadTemplate(path)
						}
					})
					.on('unlink', (path: string) => {
						if (path.endsWith('.json')) {
							console.log(`🗑️  Template file removed: ${path}`)
							this.removeTemplateByPath(path)
						}
					})
					.on('error', (error: unknown) => {
						console.error('❌ Template watcher error:', error)
					})
					.on('ready', () => {
						console.log('✅ Template file watcher ready')
					})
			}

			this.isWatching = true
			console.log('👀 Started watching templates directory for changes')
		})
	}

	/** Load all template files from the templates directory */
	private async loadAllTemplates(): Promise<void> {
		try {
			console.log(`📂 Reading templates from: ${this.templatesDir}`)
			const files = (await readdir(this.templatesDir)) as string[]
			console.log(`📋 Found files: ${files.join(', ')}`)

			const jsonFiles = files.filter((file) => file.endsWith('.json'))
			console.log(`📄 JSON files to load: ${jsonFiles.join(', ')}`)

			for (const file of jsonFiles) {
				const filePath = join(this.templatesDir, file)
				console.log(`🔄 Loading template: ${filePath}`)
				await this.loadTemplate(filePath)
			}
		} catch (error) {
			console.warn(
				`⚠️  Could not read templates directory: ${this.templatesDir}`
			)
			console.error(error)
		}
	}

	/** Load a single template file */
	private async loadTemplate(filePath: string): Promise<void> {
		try {
			const content = await readFile(filePath, 'utf-8')
			const templateData = JSON.parse(content)

			// Apply defaults and auto-generate variables
			const processedTemplateData = this.processTemplateData(templateData)

			// Validate template structure using JSON schema
			const validationResult = validateTemplateData(processedTemplateData)
			if (!validationResult.isValid) {
				console.error(`❌ Invalid template structure in ${filePath}:`)
				if (validationResult.errors) {
					for (const error of validationResult.errors) {
						console.error(`  - ${error.path}: ${error.message}`)
					}
				}
				return
			}

			const template = validationResult.data as Template
			const templateKey = `${template.name}_${template.language}`
			this.templates.set(templateKey, template)

			console.log(`✅ Loaded template: ${templateKey}`)
		} catch (error) {
			console.error(`❌ Error loading template from ${filePath}:`, error)
		}
	}

	/** Process template data to apply defaults and auto-generate variables */
	private processTemplateData(
		templateData: Partial<Template> & {
			name: string
			components: TemplateComponent[]
		}
	): Template {
		const processed = { ...templateData }

		// Apply default language if not provided
		if (!processed.language) {
			processed.language = 'en'
		}

		// Apply default category if not provided
		if (!processed.category) {
			processed.category = 'UTILITY'
		}

		// Auto-generate variables if not provided or merge with existing
		if (processed.components) {
			const autoGeneratedVariables = generateVariablesFromTemplate(
				processed.components
			)

			if (!processed.variables) {
				// No existing variables, use auto-generated ones
				processed.variables = autoGeneratedVariables
			} else {
				// Merge existing variables with auto-generated ones (existing takes precedence)
				processed.variables = {
					...autoGeneratedVariables,
					...processed.variables,
				}
			}
		}

		return processed
	}

	/** Remove template by file path */
	private removeTemplateByPath(filePath: string): void {
		const fileName = filePath.split('/').pop()?.replace('.json', '')
		if (!fileName) return

		// Find template key by matching file name
		const templateKey = Array.from(this.templates.keys()).find((key) =>
			key.startsWith(fileName)
		)

		if (templateKey) {
			this.templates.delete(templateKey)
			console.log(`✅ Removed template: ${templateKey}`)
		}
	}

	/**
	 * Adds a new template to the store.
	 * In a real application, this would also write to a file.
	 */
	async addTemplate(templateData: CreateTemplateRequest): Promise<Template> {
		const template: Template = {
			...templateData,
			components: templateData.components || [],
		}

		// Simulate file writing for consistency, not actually writing
		const processedTemplate = this.processTemplateData(template)
		const templateKey = `${processedTemplate.name}_${processedTemplate.language}`
		this.templates.set(templateKey, processedTemplate)

		console.log(`✅ Added new template: ${templateKey}`)
		return processedTemplate
	}

	/**
	 * Updates an existing template.
	 */
	async updateTemplate(
		name: string,
		language: string,
		updateData: UpdateTemplateRequest
	): Promise<Template | null> {
		const templateKey = `${name}_${language}`
		const existingTemplate = this.templates.get(templateKey)

		if (!existingTemplate) {
			return null
		}

		const updatedTemplate: Template = {
			...existingTemplate,
			...updateData,
			components: updateData.components || existingTemplate.components,
		}

		const processedTemplate = this.processTemplateData(updatedTemplate)
		this.templates.set(templateKey, processedTemplate)

		console.log(`🔄 Updated template: ${templateKey}`)
		return processedTemplate
	}

	/**
	 * Deletes a template from the store.
	 */
	async deleteTemplate(name: string, language: string): Promise<boolean> {
		const templateKey = `${name}_${language}`
		if (this.templates.has(templateKey)) {
			this.templates.delete(templateKey)
			console.log(`🗑️  Deleted template: ${templateKey}`)
			return true
		}
		return false
	}

	/** Get template by name and language */
	getTemplate(name: string, language = 'en'): Template | undefined {
		const key = `${name}_${language}`
		return this.templates.get(key)
	}

	/** Get all templates */
	getAllTemplates(): Template[] {
		return Array.from(this.templates.values())
	}

	/** Get templates by category */
	getTemplatesByCategory(category: Template['category']): Template[] {
		return Array.from(this.templates.values()).filter(
			(template) => template.category === category
		)
	}

	/** Get template names for listing */
	getTemplateNames(): string[] {
		return Array.from(this.templates.values()).map((template) => template.name)
	}

	/** Get template stats */
	getStats() {
		return {
			totalTemplates: this.templates.size,
			templatesByCategory: {
				MARKETING: this.getTemplatesByCategory('MARKETING').length,
				UTILITY: this.getTemplatesByCategory('UTILITY').length,
				AUTHENTICATION: this.getTemplatesByCategory('AUTHENTICATION').length,
			},
			isWatching: this.isWatching,
			templatesDir: this.templatesDir,
			templateKeys: Array.from(this.templates.keys()),
		}
	}

	/** Manually reload all templates (for testing/debugging) */
	async reloadTemplates(): Promise<void> {
		console.log('🔄 Manually reloading all templates...')
		this.templates.clear()
		await this.loadAllTemplates()
		console.log(`✅ Manually reloaded ${this.templates.size} templates`)
	}

	/** Clean up resources */
	async cleanup(): Promise<void> {
		if (this.watcher) {
			await this.watcher.close()
			this.isWatching = false
			console.log('🔒 Template watcher stopped')
		}
	}
}

// Export singleton instance
export const templateStore = new TemplateStore()

// Re-export Template type for modules that previously imported it from this file
export type { Template }

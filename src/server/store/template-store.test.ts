import { readdir, readFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TemplateResolver } from '../template-resolver.ts'
import { type Template, TemplateStore } from './template-store.ts'

// Mock fs promises for controlled testing
vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
	readdir: vi.fn(),
	mkdir: vi.fn(),
	writeFile: vi.fn(),
	rm: vi.fn(),
}))

// Mock chokidar for file watching with proper close method
vi.mock('chokidar', () => ({
	default: {
		watch: vi.fn(() => ({
			on: vi.fn().mockReturnThis(),
			close: vi.fn().mockResolvedValue(undefined),
		})),
	},
}))

describe('TemplateStore', () => {
	let templateStore: TemplateStore
	const testTemplatesDir = './test-templates'

	// Sample template for testing
	const sampleTemplate: Template = {
		name: 'test_template',
		language: 'en',
		category: 'UTILITY',
		components: [
			{
				type: 'HEADER',
				format: 'TEXT',
				text: 'Test Header',
			},
			{
				type: 'BODY',
				text: 'Hello {{1}}, this is a test template.',
			},
		],
		variables: {
			'1': {
				description: 'User name',
				example: 'John',
			},
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		templateStore = new TemplateStore(testTemplatesDir)
	})

	afterEach(async () => {
		if (templateStore) {
			await templateStore.cleanup()
		}
	})

	describe('initialization', () => {
		test('should initialize with empty template store', () => {
			expect(templateStore.getAllTemplates()).toEqual([])
			expect(templateStore.getTemplateNames()).toEqual([])
		})

		test('should load templates during initialization', async () => {
			const mockFiles = ['template1.json', 'template2.json', 'readme.txt']
			const mockTemplateContent = JSON.stringify(sampleTemplate)

			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(mockFiles)
			vi.mocked(readFile).mockResolvedValue(mockTemplateContent)

			await templateStore.initialize()

			expect(readdir).toHaveBeenCalledWith(
				expect.stringMatching(/test-templates$/)
			)
			expect(readFile).toHaveBeenCalledTimes(2) // Only JSON files
		})

		test('should handle missing templates directory gracefully', async () => {
			vi.mocked(readdir).mockRejectedValue(new Error('Directory not found'))

			await expect(templateStore.initialize()).resolves.not.toThrow()
		})
	})

	describe('template storage and retrieval', () => {
		test('should store and retrieve template correctly', async () => {
			const mockTemplateContent = JSON.stringify(sampleTemplate)
			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['test.json'])
			vi.mocked(readFile).mockResolvedValue(mockTemplateContent)

			await templateStore.initialize()

			const retrieved = templateStore.getTemplate('test_template', 'en')
			expect(retrieved).toEqual(sampleTemplate)
		})

		test('should return undefined for non-existent template', () => {
			const result = templateStore.getTemplate('non_existent', 'en')
			expect(result).toBeUndefined()
		})

		test('should get all templates', async () => {
			const mockTemplateContent = JSON.stringify(sampleTemplate)
			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['test.json'])
			vi.mocked(readFile).mockResolvedValue(mockTemplateContent)

			await templateStore.initialize()

			const allTemplates = templateStore.getAllTemplates()
			expect(allTemplates).toHaveLength(1)
			expect(allTemplates[0]).toEqual(sampleTemplate)
		})

		test('should get templates by category', async () => {
			const utilityTemplate = {
				...sampleTemplate,
				name: 'utility_template',
				category: 'UTILITY' as const,
			}
			const authTemplate = {
				...sampleTemplate,
				name: 'auth_template',
				category: 'AUTHENTICATION' as const,
			}

			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['utility.json', 'auth.json'])
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(utilityTemplate))
				.mockResolvedValueOnce(JSON.stringify(authTemplate))

			await templateStore.initialize()

			const utilityTemplates = templateStore.getTemplatesByCategory('UTILITY')
			const authTemplates =
				templateStore.getTemplatesByCategory('AUTHENTICATION')

			expect(utilityTemplates).toHaveLength(1)
			expect(authTemplates).toHaveLength(1)
			expect(utilityTemplates[0].category).toBe('UTILITY')
			expect(authTemplates[0].category).toBe('AUTHENTICATION')
		})

		test('should get template names', async () => {
			const template1 = { ...sampleTemplate, name: 'template1' }
			const template2 = { ...sampleTemplate, name: 'template2' }

			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['template1.json', 'template2.json'])
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(template1))
				.mockResolvedValueOnce(JSON.stringify(template2))

			await templateStore.initialize()

			const names = templateStore.getTemplateNames()
			expect(names).toEqual(['template1', 'template2'])
		})
	})

	describe('template validation', () => {
		test('should reject invalid template structure', async () => {
			const invalidTemplate = {
				name: 'invalid',
				// Missing required fields
			}

			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['invalid.json'])
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidTemplate))

			await templateStore.initialize()

			// Template should not be stored if invalid
			expect(templateStore.getAllTemplates()).toHaveLength(0)
		})

		test('should handle malformed JSON', async () => {
			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['malformed.json'])
			vi.mocked(readFile).mockResolvedValue('{ invalid json }')

			await templateStore.initialize()

			// Should not crash and should not store any templates
			expect(templateStore.getAllTemplates()).toHaveLength(0)
		})
	})

	describe('template reloading', () => {
		test('should reload templates successfully', async () => {
			const mockTemplateContent = JSON.stringify(sampleTemplate)
			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['test.json'])
			vi.mocked(readFile).mockResolvedValue(mockTemplateContent)

			await templateStore.initialize()
			expect(templateStore.getAllTemplates()).toHaveLength(1)

			// Mock additional template for reload
			const newTemplate = { ...sampleTemplate, name: 'new_template' }
			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['test.json', 'new.json'])
			vi.mocked(readFile)
				.mockResolvedValueOnce(mockTemplateContent)
				.mockResolvedValueOnce(JSON.stringify(newTemplate))

			await templateStore.reloadTemplates()

			expect(templateStore.getAllTemplates()).toHaveLength(2)
		})
	})

	describe('statistics and monitoring', () => {
		test('should provide accurate statistics', async () => {
			const utilityTemplate = {
				...sampleTemplate,
				category: 'UTILITY' as const,
			}
			const authTemplate = {
				...sampleTemplate,
				name: 'auth_template',
				category: 'AUTHENTICATION' as const,
			}

			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['utility.json', 'auth.json'])
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(utilityTemplate))
				.mockResolvedValueOnce(JSON.stringify(authTemplate))

			await templateStore.initialize()

			const stats = templateStore.getStats()

			expect(stats.totalTemplates).toBe(2)
			expect(stats.usingCustomResolver).toBe(false)
			if (!stats.usingCustomResolver) {
				const categoryStats = stats.templatesByCategory as {
					MARKETING: number
					UTILITY: number
					AUTHENTICATION: number
				}
				const templateKeys = stats.templateKeys as string[]
				expect(categoryStats.UTILITY).toBe(1)
				expect(categoryStats.AUTHENTICATION).toBe(1)
				expect(categoryStats.MARKETING).toBe(0)
				expect(templateKeys).toHaveLength(2)
			}
			expect(stats.isWatching).toBe(true)
			expect(stats.templatesDir).toMatch(/test-templates$/)
		})
	})

	describe('memory management', () => {
		test('should clean up file watcher on cleanup', async () => {
			const mockTemplateContent = JSON.stringify(sampleTemplate)
			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['test.json'])
			vi.mocked(readFile).mockResolvedValue(mockTemplateContent)

			await templateStore.initialize()
			expect(templateStore.getAllTemplates()).toHaveLength(1)

			await templateStore.cleanup()

			// After cleanup, templates should still be in memory (only file watcher is cleaned up)
			// The in-memory storage persists until server restart as required by the task
			expect(templateStore.getAllTemplates()).toHaveLength(1)
		})

		test('should reset templates on server restart (simulated by new instance)', () => {
			// This tests the requirement that templates reset on server restart
			const originalStore = new TemplateStore(testTemplatesDir)

			// New instance should start empty (simulating server restart)
			const newStore = new TemplateStore(testTemplatesDir)

			expect(newStore.getAllTemplates()).toHaveLength(0)
			expect(newStore.getTemplateNames()).toHaveLength(0)
		})
	})

	describe('template key generation', () => {
		test('should generate consistent template keys', async () => {
			const template1 = { ...sampleTemplate, name: 'test', language: 'en' }
			const template2 = { ...sampleTemplate, name: 'test', language: 'es' }

			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['en.json', 'es.json'])
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(template1))
				.mockResolvedValueOnce(JSON.stringify(template2))

			await templateStore.initialize()

			// Should store both templates with different keys
			expect(templateStore.getTemplate('test', 'en')).toBeDefined()
			expect(templateStore.getTemplate('test', 'es')).toBeDefined()
			expect(templateStore.getAllTemplates()).toHaveLength(2)
		})

		test('should handle template key conflicts by overwriting', async () => {
			const template1 = { ...sampleTemplate, name: 'test', language: 'en' }
			const template2 = {
				...sampleTemplate,
				name: 'test',
				language: 'en',
				category: 'MARKETING' as const,
			}

			// @ts-expect-error - Mocking readdir for testing
			vi.mocked(readdir).mockResolvedValue(['test1.json', 'test2.json'])
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(template1))
				.mockResolvedValueOnce(JSON.stringify(template2))

			await templateStore.initialize()

			// Second template should overwrite the first
			expect(templateStore.getAllTemplates()).toHaveLength(1)
			expect(templateStore.getTemplate('test', 'en')?.category).toBe(
				'MARKETING'
			)
		})
	})

	describe('TemplateStore with Custom Resolver', () => {
		let mockResolver: TemplateResolver
		let templateStoreWithResolver: TemplateStore

		// Mock template that our resolver will return
		const mockResolvedTemplate: Template = {
			name: 'resolved_template',
			language: 'en',
			category: 'UTILITY',
			components: [
				{
					type: 'BODY',
					text: 'Test template from resolver',
				},
			],
		}

		beforeEach(() => {
			vi.clearAllMocks()
		})

		afterEach(async () => {
			if (templateStoreWithResolver) {
				await templateStoreWithResolver.cleanup()
			}
		})

		test('should use custom resolver instead of file system', async () => {
			// Create a mock resolver that returns our test template
			mockResolver = new TemplateResolver(
				"bun -e \"console.log(JSON.stringify({name: process.argv[2], language: process.argv[4] || 'en', category: 'UTILITY', components: [{type: 'BODY', text: 'Test template'}]}))\""
			)

			// Mock the resolver's resolveTemplate method
			const resolveTemplateSpy = vi
				.spyOn(mockResolver, 'resolveTemplate')
				.mockReturnValue(mockResolvedTemplate)

			// Initialize store with the resolver
			templateStoreWithResolver = new TemplateStore(
				'./test-templates',
				mockResolver
			)
			await templateStoreWithResolver.initialize()

			// Test that getTemplate uses the resolver
			const result = templateStoreWithResolver.getTemplate(
				'test_template',
				'en'
			)

			// Verify that the resolver was called
			expect(resolveTemplateSpy).toHaveBeenCalledWith('test_template', 'en')
			expect(result).toEqual(mockResolvedTemplate)

			// Verify that file system methods were NOT called
			expect(readdir).not.toHaveBeenCalled()
			expect(readFile).not.toHaveBeenCalled()
		})

		test('should handle resolver errors gracefully', async () => {
			// Create a resolver that will return null (simulating failure)
			mockResolver = new TemplateResolver('invalid-command-that-fails')
			const resolveTemplateSpy = vi
				.spyOn(mockResolver, 'resolveTemplate')
				.mockReturnValue(null)

			templateStoreWithResolver = new TemplateStore(
				'./test-templates',
				mockResolver
			)
			await templateStoreWithResolver.initialize()

			// Test that getTemplate returns undefined when resolver fails
			const result = templateStoreWithResolver.getTemplate(
				'failing_template',
				'en'
			)

			expect(resolveTemplateSpy).toHaveBeenCalledWith('failing_template', 'en')
			expect(result).toBeUndefined()
		})

		test('should not start file watcher when resolver is provided', async () => {
			// Mock the chokidar import to track if it's called
			const chokidarMock = await import('chokidar')
			const watchSpy = vi.spyOn(chokidarMock.default, 'watch')

			mockResolver = new TemplateResolver('echo test')
			templateStoreWithResolver = new TemplateStore(
				'./test-templates',
				mockResolver
			)

			await templateStoreWithResolver.initialize()

			// Verify that chokidar.watch was never called
			expect(watchSpy).not.toHaveBeenCalled()

			// Verify stats show file watching is disabled
			const stats = templateStoreWithResolver.getStats()
			expect(stats.isWatching).toBe(false)
			expect(stats.usingCustomResolver).toBe(true)
		})

		test('should pass correct arguments to command', async () => {
			// Create a resolver with a command that we can verify receives correct arguments
			mockResolver = new TemplateResolver('test-command')

			// Mock the resolveTemplate method to capture the arguments
			const resolveTemplateSpy = vi
				.spyOn(mockResolver, 'resolveTemplate')
				.mockReturnValue(mockResolvedTemplate)

			templateStoreWithResolver = new TemplateStore(
				'./test-templates',
				mockResolver
			)
			await templateStoreWithResolver.initialize()

			// Test with different name and language combinations
			templateStoreWithResolver.getTemplate('welcome_message', 'es')
			expect(resolveTemplateSpy).toHaveBeenCalledWith('welcome_message', 'es')

			templateStoreWithResolver.getTemplate('order_confirmation', 'fr')
			expect(resolveTemplateSpy).toHaveBeenCalledWith(
				'order_confirmation',
				'fr'
			)

			// Test with default language
			templateStoreWithResolver.getTemplate('test_template')
			expect(resolveTemplateSpy).toHaveBeenCalledWith('test_template', 'en')
		})

		test('should return correct stats when using custom resolver', async () => {
			mockResolver = new TemplateResolver('test-command')
			templateStoreWithResolver = new TemplateStore(
				'./custom-dir',
				mockResolver
			)
			await templateStoreWithResolver.initialize()

			const stats = templateStoreWithResolver.getStats()

			expect(stats.usingCustomResolver).toBe(true)
			expect(stats.isWatching).toBe(false)
			expect(stats.totalTemplates).toBe('Using custom resolver')
			expect(stats.templatesByCategory).toBe('Using custom resolver')
			expect(stats.templateKeys).toBe('Using custom resolver')
			expect(stats.templatesDir).toMatch(/custom-dir$/)
		})

		test('should not call file system operations during initialization with resolver', async () => {
			mockResolver = new TemplateResolver('test-command')
			templateStoreWithResolver = new TemplateStore(
				'./test-templates',
				mockResolver
			)

			await templateStoreWithResolver.initialize()

			// Verify that no file system operations were performed
			expect(readdir).not.toHaveBeenCalled()
			expect(readFile).not.toHaveBeenCalled()
		})

		test('should handle resolver returning different templates for same name with different languages', async () => {
			const englishTemplate: Template = {
				name: 'multi_lang',
				language: 'en',
				category: 'UTILITY',
				components: [{ type: 'BODY', text: 'Hello' }],
			}

			const spanishTemplate: Template = {
				name: 'multi_lang',
				language: 'es',
				category: 'UTILITY',
				components: [{ type: 'BODY', text: 'Hola' }],
			}

			mockResolver = new TemplateResolver('test-command')
			const resolveTemplateSpy = vi
				.spyOn(mockResolver, 'resolveTemplate')
				.mockImplementation((name, language) => {
					if (name === 'multi_lang' && language === 'en') return englishTemplate
					if (name === 'multi_lang' && language === 'es') return spanishTemplate
					return null
				})

			templateStoreWithResolver = new TemplateStore(
				'./test-templates',
				mockResolver
			)
			await templateStoreWithResolver.initialize()

			const enResult = templateStoreWithResolver.getTemplate('multi_lang', 'en')
			const esResult = templateStoreWithResolver.getTemplate('multi_lang', 'es')

			expect(enResult).toEqual(englishTemplate)
			expect(esResult).toEqual(spanishTemplate)
			expect(resolveTemplateSpy).toHaveBeenCalledWith('multi_lang', 'en')
			expect(resolveTemplateSpy).toHaveBeenCalledWith('multi_lang', 'es')
		})

		test('should not modify templates returned by resolver', async () => {
			const originalTemplate: Template = {
				name: 'immutable_template',
				language: 'en',
				category: 'MARKETING',
				components: [{ type: 'BODY', text: 'Original content' }],
			}

			mockResolver = new TemplateResolver('test-command')
			vi.spyOn(mockResolver, 'resolveTemplate').mockReturnValue(
				originalTemplate
			)

			templateStoreWithResolver = new TemplateStore(
				'./test-templates',
				mockResolver
			)
			await templateStoreWithResolver.initialize()

			const result = templateStoreWithResolver.getTemplate(
				'immutable_template',
				'en'
			)

			// The template should be returned as-is from the resolver
			expect(result).toEqual(originalTemplate)
			expect(result).toBe(originalTemplate) // Should be the exact same object reference
		})
	})
})

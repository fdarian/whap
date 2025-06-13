import { beforeEach, describe, expect, test, vi } from 'vitest'
import { templateStore } from '../store/template-store.ts'
import type { Template } from '../types/api-types.ts'
import { processTemplate } from './messages.ts'

// Mock template store
vi.mock('../store/template-store.ts', () => ({
	templateStore: {
		getTemplate: vi.fn(),
	},
}))

const mockTemplateStore = vi.mocked(templateStore)

describe('processTemplate - Unit Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Named Parameters Only', () => {
		test('should substitute named parameters correctly', () => {
			const mockTemplate: Template = {
				name: 'welcome_message_named',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Hello {{name}}, welcome to {{company}}! Your email {{email}} has been registered.',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'name', text: 'John Doe' },
				{
					type: 'text' as const,
					parameter_name: 'company',
					text: 'WhatsApp Corp',
				},
				{
					type: 'text' as const,
					parameter_name: 'email',
					text: 'john@example.com',
				},
			]

			const result = processTemplate('welcome_message_named', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate).toBeDefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Hello John Doe, welcome to WhatsApp Corp! Your email john@example.com has been registered.'
			)
		})

		test('should handle special characters in parameter names', () => {
			const mockTemplate: Template = {
				name: 'special_chars',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'User {{user_name}} from {{company-name}} with ID {{user.id}}',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'user_name', text: 'Alice' },
				{
					type: 'text' as const,
					parameter_name: 'company-name',
					text: 'Tech Corp',
				},
				{ type: 'text' as const, parameter_name: 'user.id', text: '12345' },
			]

			const result = processTemplate('special_chars', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'User Alice from Tech Corp with ID 12345'
			)
		})

		test('should be case sensitive for parameter names', () => {
			const mockTemplate: Template = {
				name: 'case_sensitive',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Hello {{Name}} and {{name}}',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'Name', text: 'John' },
				{ type: 'text' as const, parameter_name: 'name', text: 'Jane' },
			]

			const result = processTemplate('case_sensitive', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Hello John and Jane'
			)
		})
	})

	describe('Numbered Parameters Only', () => {
		test('should substitute numbered parameters correctly', () => {
			const mockTemplate: Template = {
				name: 'welcome_message_numbered',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Hello {{1}}, your order {{2}} has been confirmed for {{3}}.',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: '1', text: 'Alice' },
				{ type: 'text' as const, parameter_name: '2', text: '#12345' },
				{ type: 'text' as const, parameter_name: '3', text: '$29.99' },
			]

			const result = processTemplate(
				'welcome_message_numbered',
				'en',
				parameters
			)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Hello Alice, your order #12345 has been confirmed for $29.99.'
			)
		})

		test('should handle multiple digit numbered parameters', () => {
			const mockTemplate: Template = {
				name: 'multi_digit_params',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Items: {{1}}, {{10}}, {{100}}',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: '1', text: 'First' },
				{ type: 'text' as const, parameter_name: '10', text: 'Tenth' },
				{ type: 'text' as const, parameter_name: '100', text: 'Hundredth' },
			]

			const result = processTemplate('multi_digit_params', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Items: First, Tenth, Hundredth'
			)
		})
	})

	describe('Mixed Parameters (Named and Numbered)', () => {
		test('should handle both named and numbered parameters in same template', () => {
			const mockTemplate: Template = {
				name: 'mixed_parameters',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Dear {{name}}, your order {{1}} is ready. Contact us at {{email}} or call {{2}}.',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'name', text: 'Bob' },
				{ type: 'text' as const, parameter_name: '1', text: '#ORD-001' },
				{
					type: 'text' as const,
					parameter_name: 'email',
					text: 'support@company.com',
				},
				{ type: 'text' as const, parameter_name: '2', text: '+1-555-0123' },
			]

			const result = processTemplate('mixed_parameters', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Dear Bob, your order #ORD-001 is ready. Contact us at support@company.com or call +1-555-0123.'
			)
		})

		test('should handle mixed parameters across multiple components', () => {
			const mockTemplate: Template = {
				name: 'multi_component_mixed',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'HEADER',
						text: 'Welcome {{name}}!',
					},
					{
						type: 'BODY',
						text: 'Your account {{1}} has been created. Visit {{url}} to get started.',
					},
					{
						type: 'FOOTER',
						text: 'Support: {{2}}',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'name', text: 'Charlie' },
				{
					type: 'text' as const,
					parameter_name: '1',
					text: 'charlie@example.com',
				},
				{
					type: 'text' as const,
					parameter_name: 'url',
					text: 'https://app.example.com',
				},
				{
					type: 'text' as const,
					parameter_name: '2',
					text: 'help@example.com',
				},
			]

			const result = processTemplate('multi_component_mixed', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Welcome Charlie!'
			)
			expect(result.processedTemplate?.components[1]?.text).toBe(
				'Your account charlie@example.com has been created. Visit https://app.example.com to get started.'
			)
			expect(result.processedTemplate?.components[2]?.text).toBe(
				'Support: help@example.com'
			)
		})
	})

	describe('Missing Parameters Handling', () => {
		test('should keep placeholders when parameters are missing', () => {
			const mockTemplate: Template = {
				name: 'missing_params',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Hello {{name}}, your balance is {{balance}} and status is {{status}}.',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			// Only provide one parameter, leaving others missing
			const parameters = [
				{ type: 'text' as const, parameter_name: 'name', text: 'David' },
			]

			const result = processTemplate('missing_params', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Hello David, your balance is {{balance}} and status is {{status}}.'
			)
		})

		test('should handle completely missing parameters', () => {
			const mockTemplate: Template = {
				name: 'all_missing',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Hello {{name}}, welcome to {{company}}!',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters: Array<{
				type: 'text'
				parameter_name: string
				text: string
			}> = []

			const result = processTemplate('all_missing', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Hello {{name}}, welcome to {{company}}!'
			)
		})

		test('should handle partial matches with mixed parameters', () => {
			const mockTemplate: Template = {
				name: 'partial_mixed',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'User {{name}} has order {{1}} with status {{status}} and ID {{2}}.',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'name', text: 'Eve' },
				{ type: 'text' as const, parameter_name: '2', text: 'ID-789' },
				// Missing: '1' and 'status'
			]

			const result = processTemplate('partial_mixed', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'User Eve has order {{1}} with status {{status}} and ID ID-789.'
			)
		})
	})

	describe('Edge Cases and Validation', () => {
		test('should handle empty parameter values', () => {
			const mockTemplate: Template = {
				name: 'empty_values',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Name: {{name}}, Company: {{company}}',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'name', text: '' },
				{ type: 'text' as const, parameter_name: 'company', text: 'Tech Corp' },
			]

			const result = processTemplate('empty_values', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Name: , Company: Tech Corp'
			)
		})

		test('should handle whitespace in parameter values', () => {
			const mockTemplate: Template = {
				name: 'whitespace_values',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Message: "{{message}}"',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{
					type: 'text' as const,
					parameter_name: 'message',
					text: '  Hello World  ',
				},
			]

			const result = processTemplate('whitespace_values', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Message: "  Hello World  "'
			)
		})

		test('should handle duplicate parameter names (last one wins)', () => {
			const mockTemplate: Template = {
				name: 'duplicate_params',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Value: {{value}}',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'value', text: 'First' },
				{ type: 'text' as const, parameter_name: 'value', text: 'Second' },
			]

			const result = processTemplate('duplicate_params', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Value: Second'
			)
		})

		test('should handle malformed placeholders gracefully', () => {
			const mockTemplate: Template = {
				name: 'malformed_placeholders',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Valid: {{name}}, Invalid: {broken}, Normal: {{email}}',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'name', text: 'Frank' },
				{
					type: 'text' as const,
					parameter_name: 'email',
					text: 'frank@example.com',
				},
			]

			const result = processTemplate('malformed_placeholders', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Valid: Frank, Invalid: {broken}, Normal: frank@example.com'
			)
		})

		test('should handle components without text property', () => {
			const mockTemplate: Template = {
				name: 'no_text_component',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Hello {{name}}',
					},
					{
						type: 'BUTTONS',
						// No text property
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'name', text: 'Grace' },
			]

			const result = processTemplate('no_text_component', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe('Hello Grace')
			expect(result.processedTemplate?.components[1]?.text).toBeUndefined()
		})
	})

	describe('Template Not Found Scenarios', () => {
		test('should return error when template is not found', () => {
			mockTemplateStore.getTemplate.mockReturnValue(undefined)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'name', text: 'Test' },
			]

			const result = processTemplate('non_existent_template', 'en', parameters)

			expect(result.processedTemplate).toBeNull()
			expect(result.error).toBe(
				'Template "non_existent_template" with language "en" not found'
			)
		})

		test('should return error for wrong language', () => {
			mockTemplateStore.getTemplate.mockReturnValue(undefined)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'name', text: 'Test' },
			]

			const result = processTemplate('existing_template', 'es', parameters)

			expect(result.processedTemplate).toBeNull()
			expect(result.error).toBe(
				'Template "existing_template" with language "es" not found'
			)
		})
	})

	describe('Parameter Name Field Validation', () => {
		test('should handle various parameter_name formats', () => {
			const mockTemplate: Template = {
				name: 'param_formats',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: '{{snake_case}} {{camelCase}} {{PascalCase}} {{kebab-case}} {{UPPER_CASE}}',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: 'snake_case', text: 'Snake' },
				{ type: 'text' as const, parameter_name: 'camelCase', text: 'Camel' },
				{ type: 'text' as const, parameter_name: 'PascalCase', text: 'Pascal' },
				{ type: 'text' as const, parameter_name: 'kebab-case', text: 'Kebab' },
				{ type: 'text' as const, parameter_name: 'UPPER_CASE', text: 'Upper' },
			]

			const result = processTemplate('param_formats', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Snake Camel Pascal Kebab Upper'
			)
		})

		test('should handle numeric parameter names as strings', () => {
			const mockTemplate: Template = {
				name: 'numeric_names',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Order {{0}} for {{1}} items costs {{2}}',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: '0', text: '#123' },
				{ type: 'text' as const, parameter_name: '1', text: '5' },
				{ type: 'text' as const, parameter_name: '2', text: '$25.99' },
			]

			const result = processTemplate('numeric_names', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'Order #123 for 5 items costs $25.99'
			)
		})

		test('should handle unicode characters in parameter names', () => {
			const mockTemplate: Template = {
				name: 'unicode_params',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'User: {{用户名}}, Price: {{价格}}',
					},
				],
			}

			mockTemplateStore.getTemplate.mockReturnValue(mockTemplate)

			const parameters = [
				{ type: 'text' as const, parameter_name: '用户名', text: '张三' },
				{ type: 'text' as const, parameter_name: '价格', text: '¥100' },
			]

			const result = processTemplate('unicode_params', 'en', parameters)

			expect(result.error).toBeUndefined()
			expect(result.processedTemplate?.components[0]?.text).toBe(
				'User: 张三, Price: ¥100'
			)
		})
	})
})

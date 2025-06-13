import { describe, expect, test } from 'vitest'
import type {
	Template,
	WhatsAppSendMessageRequest,
	WhatsAppTypingRequest,
} from '../types/api-types.ts'
import {
	type ValidationError,
	formatValidationErrorForAPI,
	validateTemplateData,
	validateWhatsAppMessageRequest,
	validateWhatsAppTypingRequest,
} from './validator.ts'

describe('WhatsApp Message Request Validation', () => {
	test('validates valid text message request', () => {
		const validTextMessage: WhatsAppSendMessageRequest = {
			messaging_product: 'whatsapp',
			to: '1234567890',
			type: 'text',
			text: {
				body: 'Hello, World!',
			},
		}

		const result = validateWhatsAppMessageRequest(validTextMessage)

		expect(result.isValid).toBe(true)
		expect(result.data).toEqual(validTextMessage)
		expect(result.errors).toBeUndefined()
	})

	test('validates valid template message request', () => {
		const validTemplateMessage: WhatsAppSendMessageRequest = {
			messaging_product: 'whatsapp',
			to: '1234567890',
			type: 'template',
			template: {
				name: 'welcome_template',
				language: { code: 'en' },
				components: [
					{
						type: 'body',
						parameters: [
							{
								type: 'text',
								parameter_name: 'name',
								text: 'John Doe',
							},
						],
					},
				],
			},
		}

		const result = validateWhatsAppMessageRequest(validTemplateMessage)

		expect(result.isValid).toBe(true)
		expect(result.data).toEqual(validTemplateMessage)
		expect(result.errors).toBeUndefined()
	})

	test('rejects message with invalid messaging_product', () => {
		const invalidMessage = {
			messaging_product: 'invalid',
			to: '1234567890',
			type: 'text',
			text: { body: 'Hello' },
		}

		const result = validateWhatsAppMessageRequest(invalidMessage)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
		expect(result.errors?.[0]?.message).toContain('must be equal to constant')
	})

	test('rejects message without required to field', () => {
		const invalidMessage = {
			messaging_product: 'whatsapp',
			type: 'text',
			text: { body: 'Hello' },
		}

		const result = validateWhatsAppMessageRequest(invalidMessage)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
		expect(
			result.errors?.some((error) =>
				error.message.includes('required property')
			)
		).toBe(true)
	})

	test('rejects text message without text.body', () => {
		const invalidMessage = {
			messaging_product: 'whatsapp',
			to: '1234567890',
			type: 'text',
		}

		const result = validateWhatsAppMessageRequest(invalidMessage)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
	})

	test('rejects template message without template field', () => {
		const invalidMessage = {
			messaging_product: 'whatsapp',
			to: '1234567890',
			type: 'template',
		}

		const result = validateWhatsAppMessageRequest(invalidMessage)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
	})

	test('rejects message with invalid type', () => {
		const invalidMessage = {
			messaging_product: 'whatsapp',
			to: '1234567890',
			type: 'invalid_type',
		}

		const result = validateWhatsAppMessageRequest(invalidMessage)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
	})
})

describe('WhatsApp Typing Request Validation', () => {
	test('validates valid typing indicator request', () => {
		const validTypingRequest: WhatsAppTypingRequest = {
			messaging_product: 'whatsapp',
			status: 'read',
			message_id: 'msg_123456',
			typing_indicator: {
				type: 'text',
			},
		}

		const result = validateWhatsAppTypingRequest(validTypingRequest)

		expect(result.isValid).toBe(true)
		expect(result.data).toEqual(validTypingRequest)
		expect(result.errors).toBeUndefined()
	})

	test('rejects typing request with invalid status', () => {
		const invalidRequest = {
			messaging_product: 'whatsapp',
			status: 'invalid_status',
			message_id: 'msg_123456',
			typing_indicator: { type: 'text' },
		}

		const result = validateWhatsAppTypingRequest(invalidRequest)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
	})

	test('rejects typing request without message_id', () => {
		const invalidRequest = {
			messaging_product: 'whatsapp',
			status: 'read',
			typing_indicator: { type: 'text' },
		}

		const result = validateWhatsAppTypingRequest(invalidRequest)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
	})

	test('rejects typing request without typing_indicator', () => {
		const invalidRequest = {
			messaging_product: 'whatsapp',
			status: 'read',
			message_id: 'msg_123456',
		}

		const result = validateWhatsAppTypingRequest(invalidRequest)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
	})
})

describe('Template Validation', () => {
	test('validates valid template', () => {
		const validTemplate: Template = {
			name: 'welcome_template',
			language: 'en',
			category: 'MARKETING',
			components: [
				{
					type: 'HEADER',
					format: 'TEXT',
					text: 'Welcome!',
				},
				{
					type: 'BODY',
					text: 'Welcome to our service, {{name}}!',
				},
				{
					type: 'BUTTONS',
					buttons: [
						{
							type: 'QUICK_REPLY',
							text: 'Get Started',
						},
						{
							type: 'URL',
							text: 'Visit Website',
							url: 'https://example.com',
						},
					],
				},
			],
			variables: {
				name: {
					description: 'User name',
					example: 'John Doe',
				},
			},
		}

		const result = validateTemplateData(validTemplate)

		expect(result.isValid).toBe(true)
		expect(result.data).toEqual(validTemplate)
		expect(result.errors).toBeUndefined()
	})

	test('validates minimal template without optional fields', () => {
		const minimalTemplate: Template = {
			name: 'simple_template',
			language: 'en',
			category: 'UTILITY',
			components: [
				{
					type: 'BODY',
					text: 'Simple message',
				},
			],
		}

		const result = validateTemplateData(minimalTemplate)

		expect(result.isValid).toBe(true)
		expect(result.data).toEqual(minimalTemplate)
		expect(result.errors).toBeUndefined()
	})

	test('rejects template without required name', () => {
		const invalidTemplate = {
			language: 'en',
			category: 'UTILITY',
			components: [{ type: 'BODY', text: 'Message' }],
		}

		const result = validateTemplateData(invalidTemplate)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
		expect(
			result.errors?.some((error) =>
				error.message.includes('required property')
			)
		).toBe(true)
	})

	test('rejects template with invalid category', () => {
		const invalidTemplate = {
			name: 'test_template',
			language: 'en',
			category: 'INVALID_CATEGORY',
			components: [{ type: 'BODY', text: 'Message' }],
		}

		const result = validateTemplateData(invalidTemplate)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
	})

	test('rejects template with invalid component type', () => {
		const invalidTemplate = {
			name: 'test_template',
			language: 'en',
			category: 'UTILITY',
			components: [{ type: 'INVALID_TYPE', text: 'Message' }],
		}

		const result = validateTemplateData(invalidTemplate)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
	})

	test('rejects template with invalid button type', () => {
		const invalidTemplate = {
			name: 'test_template',
			language: 'en',
			category: 'UTILITY',
			components: [
				{
					type: 'BUTTONS',
					buttons: [
						{
							type: 'INVALID_BUTTON_TYPE',
							text: 'Button',
						},
					],
				},
			],
		}

		const result = validateTemplateData(invalidTemplate)

		expect(result.isValid).toBe(false)
		expect(result.data).toBeUndefined()
		expect(result.errors).toBeDefined()
	})
})

describe('Error Formatting', () => {
	test('formats single validation error', () => {
		const errors: ValidationError[] = [
			{
				path: '/messaging_product',
				message: 'must be equal to constant',
				value: 'invalid',
			},
		]

		const result = formatValidationErrorForAPI(errors)

		expect(result).toBe('/messaging_product: must be equal to constant')
	})

	test('formats single root error', () => {
		const errors: ValidationError[] = [
			{
				path: 'root',
				message: 'Invalid request format',
			},
		]

		const result = formatValidationErrorForAPI(errors)

		expect(result).toBe('Invalid request format')
	})

	test('formats multiple validation errors', () => {
		const errors: ValidationError[] = [
			{
				path: '/messaging_product',
				message: 'must be equal to constant',
			},
			{
				path: '/to',
				message: 'must have required property',
			},
		]

		const result = formatValidationErrorForAPI(errors)

		expect(result).toBe(
			'Multiple validation errors: /messaging_product: must be equal to constant, /to: must have required property'
		)
	})
})

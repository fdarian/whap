import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { templateStore } from '../store/template-store.ts'
import type {
	CreateTemplateRequest,
	WhatsAppErrorResponse,
} from '../types/api-types.ts'
import { templatesRouter } from './templates.ts'

describe('Templates API Integration Tests', () => {
	let server: ReturnType<typeof serve>
	const baseUrl = 'http://localhost:3016'
	const testBusinessId = 'test-business-123'
	const testToken = 'test-token'

	beforeAll(async () => {
		// Set environment variables BEFORE creating middleware
		process.env.MOCK_API_TOKENS = testToken

		// Set up test server
		const app = new Hono()
		app.use('*', cors())
		// Authentication disabled for mock development server
		// app.use('/v22.0/*', ...createAuthMiddleware())
		app.route('/v22.0', templatesRouter)

		server = serve({
			fetch: app.fetch,
			port: 3016,
		})

		// Initialize template store and wait for it to be ready
		await templateStore.initialize()
		await new Promise((resolve) => setTimeout(resolve, 500))
	})

	afterAll(async () => {
		server?.close()
	})

	beforeEach(() => {
		// Reset templates before each test
		templateStore.reloadTemplates()
	})

	describe('GET /v22.0/{business-account-id}/message_templates', () => {
		test('should list all templates', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates`,
				{
					headers: {
						Authorization: `Bearer ${testToken}`,
					},
				}
			)

			expect(response.status).toBe(200)
			const data = await response.json()
			expect(data.data).toBeInstanceOf(Array)
			expect(data.data.length).toBeGreaterThan(0)
		})
	})

	describe('GET /v22.0/{business-account-id}/message_templates/{template-name}', () => {
		test('should get specific template', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/welcome_message?language=en`,
				{
					headers: {
						Authorization: `Bearer ${testToken}`,
					},
				}
			)

			expect(response.status).toBe(200)
			const data = await response.json()
			expect(data.name).toBe('welcome_message')
			expect(data.language).toBe('en')
		})

		test('should return 404 for non-existent template', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/non_existent_template?language=en`,
				{
					headers: {
						Authorization: `Bearer ${testToken}`,
					},
				}
			)

			expect(response.status).toBe(404)
		})

		test('should return 404 for existing template with wrong language', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/welcome_message?language=fr`,
				{
					headers: {
						Authorization: `Bearer ${testToken}`,
					},
				}
			)
			expect(response.status).toBe(404)
		})
	})

	describe('POST /v22.0/{business-account-id}/message_templates', () => {
		test('should create new template', async () => {
			const newTemplate: CreateTemplateRequest = {
				name: 'new_test_template',
				language: 'en_US',
				category: 'MARKETING',
				components: [{ type: 'BODY', text: 'Hello world' }],
			}

			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${testToken}`,
					},
					body: JSON.stringify(newTemplate),
				}
			)

			expect(response.status).toBe(201)
			const data = await response.json()
			expect(data.status).toBe('PENDING')
		})

		test('should return 409 for duplicate template', async () => {
			const existingTemplate: CreateTemplateRequest = {
				name: 'sample_template',
				language: 'en_US',
				category: 'MARKETING',
				components: [{ type: 'BODY', text: 'Hello world' }],
			}

			// First attempt should succeed
			await fetch(`${baseUrl}/v22.0/${testBusinessId}/message_templates`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify(existingTemplate),
			})

			// Second attempt should fail
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${testToken}`,
					},
					body: JSON.stringify(existingTemplate),
				}
			)

			expect(response.status).toBe(409)
		})

		test('should return 400 for invalid template data', async () => {
			const invalidTemplate = {
				name: 'invalid_template',
				// Missing language, category, components
			}

			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${testToken}`,
					},
					body: JSON.stringify(invalidTemplate),
				}
			)

			expect(response.status).toBe(400)
			const data = (await response.json()) as WhatsAppErrorResponse
			expect(data.error.type).toBe('validation_error')
		})
	})

	describe('POST /v22.0/{business-account-id}/message_templates/{template-name}', () => {
		test('should update existing template', async () => {
			const templateToCreate: CreateTemplateRequest = {
				name: 'welcome_message',
				language: 'en',
				category: 'UTILITY',
				components: [{ type: 'BODY', text: 'Welcome!' }],
			}
			await fetch(`${baseUrl}/v22.0/${testBusinessId}/message_templates`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify(templateToCreate),
			})

			const updateData = {
				components: [{ type: 'BODY', text: 'Updated text' }],
			}

			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/welcome_message?language=en`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${testToken}`,
					},
					body: JSON.stringify(updateData),
				}
			)

			expect(response.status).toBe(200)
		})

		test('should return 404 for non-existent template', async () => {
			const updateData = {
				components: [{ type: 'BODY', text: 'Updated text' }],
			}

			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/non_existent_template?language=en`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${testToken}`,
					},
					body: JSON.stringify(updateData),
				}
			)
			expect(response.status).toBe(404)
		})
	})

	describe('DELETE /v22.0/{business-account-id}/message_templates/{template-name}', () => {
		test('should delete existing template', async () => {
			const templateToCreate: CreateTemplateRequest = {
				name: 'sample_template',
				language: 'en',
				category: 'MARKETING',
				components: [{ type: 'BODY', text: 'Hello world' }],
			}
			await fetch(`${baseUrl}/v22.0/${testBusinessId}/message_templates`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify(templateToCreate),
			})

			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/sample_template?language=en`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${testToken}`,
					},
				}
			)
			expect(response.status).toBe(200)
			const data = await response.json()
			expect(data.success).toBe(true)
		})

		test('should return 404 for non-existent template', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/non_existent_template?language=en`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${testToken}`,
					},
				}
			)
			expect(response.status).toBe(404)
		})
	})

	describe('Error Handling', () => {
		test('should handle malformed JSON', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${testToken}`,
					},
					body: 'invalid json',
				}
			)
			expect(response.status).toBe(400)
		})

		test('should validate Content-Type header', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'text/plain',
						Authorization: `Bearer ${testToken}`,
					},
					body: JSON.stringify({}),
				}
			)
			expect(response.status).toBe(400)
		})
	})
})

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { templateStore } from '../store/template-store.ts'
import type { Template } from '../store/template-store.ts'
import { templatesRouter } from './templates.ts'

describe('Templates API Integration Tests', () => {
	let server: ReturnType<typeof serve>
	const baseUrl = 'http://localhost:3011'
	const testBusinessId = 'test-business-123'

	beforeAll(async () => {
		// Set up test server
		const app = new Hono()
		app.use('*', cors())
		app.route('/v22.0', templatesRouter)

		server = serve({
			fetch: app.fetch,
			port: 3011,
		})

		// Initialize template store for testing
		await templateStore.initialize()

		// Wait a bit for server to start
		await new Promise((resolve) => setTimeout(resolve, 500))
	})

	afterAll(async () => {
		server?.close()
	})

	describe('GET /v22.0/{business-account-id}/message_templates', () => {
		test('should list all templates', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates`
			)

			expect(response.status).toBe(200)

			const data = await response.json()
			expect(data).toHaveProperty('data')
			expect(data).toHaveProperty('paging')
			expect(Array.isArray(data.data)).toBe(true)

			// Should have at least the default templates
			expect(data.data.length).toBeGreaterThan(0)

			// Verify template structure
			if (data.data.length > 0) {
				const template = data.data[0]
				expect(template).toHaveProperty('name')
				expect(template).toHaveProperty('language')
				expect(template).toHaveProperty('category')
				expect(template).toHaveProperty('components')
			}
		})
	})

	describe('GET /v22.0/{business-account-id}/message_templates/{template-name}', () => {
		test('should get specific template', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/welcome_message?language=en`
			)

			expect(response.status).toBe(200)

			const data = await response.json()
			expect(data.name).toBe('welcome_message')
			expect(data.language).toBe('en')
			expect(data.category).toBe('UTILITY')
			expect(Array.isArray(data.components)).toBe(true)
		})

		test('should return 404 for non-existent template', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/non_existent_template?language=en`
			)

			expect(response.status).toBe(404)

			const data = await response.json()
			expect(data.error).toHaveProperty('message')
			expect(data.error).toHaveProperty('type', 'template_not_found')
			expect(data.error).toHaveProperty('code', 404)
		})

		test('should return 404 for existing template with wrong language', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/welcome_message?language=fr`
			)

			expect(response.status).toBe(404)

			const data = await response.json()
			expect(data.error.message).toContain("not found for language 'fr'")
		})
	})

	describe('POST /v22.0/{business-account-id}/message_templates', () => {
		test('should create new template', async () => {
			const newTemplate: Template = {
				name: 'test_create_template',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'This is a test template for creation',
					},
				],
			}

			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(newTemplate),
				}
			)

			expect(response.status).toBe(201)

			const data = await response.json()
			expect(data.id).toBe('test_create_template_en')
			expect(data.status).toBe('PENDING')
			expect(data.category).toBe('UTILITY')
		})

		test('should return 409 for duplicate template', async () => {
			const existingTemplate: Template = {
				name: 'welcome_message',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Duplicate template test',
					},
				],
			}

			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(existingTemplate),
				}
			)

			expect(response.status).toBe(409)

			const data = await response.json()
			expect(data.error).toHaveProperty('type', 'duplicate_template')
			expect(data.error.message).toContain('already exists')
		})

		test('should return 400 for invalid template data', async () => {
			const invalidTemplate = {
				name: 'invalid_template',
				// Missing required fields
			}

			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(invalidTemplate),
				}
			)

			expect(response.status).toBe(400)

			const data = await response.json()
			expect(data.error).toHaveProperty('type', 'validation_error')
			expect(data.error).toHaveProperty('code', 400)
		})
	})

	describe('POST /v22.0/{business-account-id}/message_templates/{template-name}', () => {
		test('should update existing template', async () => {
			const updateData: Template = {
				name: 'welcome_message',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: 'Updated welcome message',
					},
				],
			}

			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/welcome_message`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(updateData),
				}
			)

			expect(response.status).toBe(200)

			const data = await response.json()
			expect(data.success).toBe(true)
			expect(data.id).toBe('welcome_message_en')
		})

		test('should return 404 for non-existent template', async () => {
			const updateData: Template = {
				name: 'non_existent_template',
				language: 'en',
				category: 'UTILITY',
				components: [
					{
						type: 'BODY',
						text: "This template doesn't exist",
					},
				],
			}

			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/non_existent_template`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(updateData),
				}
			)

			expect(response.status).toBe(404)

			const data = await response.json()
			expect(data.error).toHaveProperty('type', 'template_not_found')
		})
	})

	describe('DELETE /v22.0/{business-account-id}/message_templates/{template-name}', () => {
		test('should delete existing template', async () => {
			const response = await fetch(
				`${baseUrl}/v22.0/${testBusinessId}/message_templates/sample_template?language=en`,
				{
					method: 'DELETE',
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
				}
			)

			expect(response.status).toBe(404)

			const data = await response.json()
			expect(data.error).toHaveProperty('type', 'template_not_found')
			expect(data.error).toHaveProperty('code', 404)
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
					},
					body: JSON.stringify({}),
				}
			)

			expect(response.status).toBe(400)
		})
	})
})

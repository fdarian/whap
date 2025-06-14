import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from 'vitest'
import { rateLimiter } from '../middleware/auth.ts'
import { type StoredMessage, mockStore } from '../store/memory-store.ts'
import { templateStore } from '../store/template-store.ts'
import type {
	WhatsAppErrorResponse,
	WhatsAppSendMessageRequest,
	WhatsAppSendMessageResponse,
} from '../types/api-types.ts'
import { messagesRouter } from './messages.ts'

describe('Messages API Integration Tests', () => {
	let server: ReturnType<typeof serve>
	let mockWebhookServer: ReturnType<typeof serve>
	const baseUrl = 'http://localhost:3014'
	const mockWebhookUrl = 'http://localhost:3015/webhook'
	const testPhoneId = '12345678901'
	const testToken = 'test-token'

	// Store received webhook payloads for verification
	const receivedWebhooks: unknown[] = []

	beforeAll(async () => {
		// Set environment variables BEFORE creating middleware
		process.env.WEBHOOK_URL = mockWebhookUrl
		process.env.MOCK_API_TOKENS = testToken
		// Set rate limiting for tests: 3 requests per 5 seconds
		process.env.RATE_LIMIT_MAX_REQUESTS = '3'
		process.env.RATE_LIMIT_WINDOW_MS = '5000'

		// Set up test messages server
		const app = new Hono()
		app.use('*', cors())
		// Authentication disabled for mock development server
		// app.use('/v22.0/*', ...createAuthMiddleware())
		app.route('/v22.0', messagesRouter)

		server = serve({
			fetch: app.fetch,
			port: 3014,
		})

		// Set up mock webhook endpoint to receive webhooks
		const mockApp = new Hono()
		mockApp.use('*', cors())

		mockApp.post('/webhook', async (c) => {
			const payload = await c.req.json()
			receivedWebhooks.push(payload)
			console.log('📥 Mock webhook received:', JSON.stringify(payload, null, 2))
			return c.json({ success: true })
		})

		mockWebhookServer = serve({
			fetch: mockApp.fetch,
			port: 3015,
		})

		// Initialize template store and wait for servers to start
		await templateStore.initialize()
		await new Promise((resolve) => setTimeout(resolve, 500))
	})

	afterAll(async () => {
		server?.close()
		mockWebhookServer?.close()
	})

	beforeEach(() => {
		// Clear received webhooks and reset mocks before each test
		receivedWebhooks.length = 0
		vi.clearAllMocks()
		rateLimiter.reset()
	})

	describe('POST /v22.0/{phone-number-id}/messages - Text Messages', () => {
		test('should send text message and trigger webhooks', async () => {
			const textMessage: WhatsAppSendMessageRequest = {
				messaging_product: 'whatsapp',
				to: '1234567890',
				type: 'text',
				text: {
					body: 'Hello, this is a test message!',
				},
			}

			const response = await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify(textMessage),
			})

			expect(response.status).toBe(200)

			const data = (await response.json()) as WhatsAppSendMessageResponse
			expect(data.messaging_product).toBe('whatsapp')
			expect(data.contacts).toBeDefined()
			expect(data.messages).toBeDefined()

			if (data.contacts) {
				expect(data.contacts[0]?.wa_id).toBe(textMessage.to)
			}

			if (data.messages) {
				expect(data.messages[0]?.id).toBeDefined()
			}

			// Wait for webhooks to be delivered
			await new Promise((resolve) => setTimeout(resolve, 2000))

			// Should receive at least one webhook
			expect(receivedWebhooks.length).toBeGreaterThanOrEqual(1)
		})

		test('should validate text message request', async () => {
			const invalidMessage = {
				messaging_product: 'whatsapp',
				to: '1234567890',
				type: 'text',
				// Missing text.body
			}

			const response = await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify(invalidMessage),
			})

			expect(response.status).toBe(400)

			const data = (await response.json()) as WhatsAppErrorResponse
			expect(data.error.type).toBe('validation_error')
		})
	})

	describe('POST /v22.0/{phone-number-id}/messages - Template Messages', () => {
		test('should send template message and trigger template-specific webhooks', async () => {
			const templateMessage: WhatsAppSendMessageRequest = {
				messaging_product: 'whatsapp',
				to: '1234567890',
				type: 'template',
				template: {
					name: 'welcome_message',
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

			const response = await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify(templateMessage),
			})

			expect(response.status).toBe(200)

			const data = (await response.json()) as WhatsAppSendMessageResponse
			expect(data.messaging_product).toBe('whatsapp')
			expect(data.contacts).toBeDefined()
			expect(data.messages).toBeDefined()

			// Wait for template approval/rejection and delivery webhooks
			await new Promise((resolve) => setTimeout(resolve, 2000))

			// Should receive template-related webhooks
			expect(receivedWebhooks.length).toBeGreaterThanOrEqual(1)
		})

		test('should return error for non-existent template', async () => {
			const invalidTemplateMessage: WhatsAppSendMessageRequest = {
				messaging_product: 'whatsapp',
				to: '1234567890',
				type: 'template',
				template: {
					name: 'non_existent_template',
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

			const response = await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify(invalidTemplateMessage),
			})

			expect(response.status).toBe(400)

			const data = (await response.json()) as WhatsAppErrorResponse
			expect(data.error.type).toBe('template_error')
			expect(data.error.message).toContain('not found')
		})
	})

	describe('Authentication and Rate Limiting', () => {
		test('should return 401 for missing auth token', async () => {
			const textMessage: WhatsAppSendMessageRequest = {
				messaging_product: 'whatsapp',
				to: '1234567890',
				type: 'text',
				text: {
					body: 'This should fail',
				},
			}

			const response = await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(textMessage),
			})

			expect(response.status).toBe(401)
		})

		test('should return 401 for invalid auth token', async () => {
			const textMessage: WhatsAppSendMessageRequest = {
				messaging_product: 'whatsapp',
				to: '1234567890',
				type: 'text',
				text: {
					body: 'This should also fail',
				},
			}

			const response = await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer invalid-token',
				},
				body: JSON.stringify(textMessage),
			})

			expect(response.status).toBe(401)
		})

		test('should trigger rate limiting', async () => {
			const textMessage: WhatsAppSendMessageRequest = {
				messaging_product: 'whatsapp',
				to: '1234567890',
				type: 'text',
				text: {
					body: 'Rate limit test',
				},
			}

			// Exceed rate limit (test config: 3 requests per 5 seconds)
			for (let i = 0; i < 3; i++) {
				await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${testToken}`,
					},
					body: JSON.stringify(textMessage),
				})
			}

			// This 4th request should be rate limited
			const response = await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify(textMessage),
			})

			expect(response.status).toBe(429)
		})
	})

	describe('Message Storage Integration', () => {
		test('should store template messages in memory store', async () => {
			const templateMessage: WhatsAppSendMessageRequest = {
				messaging_product: 'whatsapp',
				to: '1234567890',
				type: 'template',
				template: {
					name: 'welcome_message',
					language: { code: 'en' },
					components: [
						{
							type: 'body',
							parameters: [
								{
									type: 'text',
									parameter_name: 'name',
									text: 'Test User',
								},
							],
						},
					],
				},
			}

			const response = await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify(templateMessage),
			})

			expect(response.status).toBe(200)

			const data = (await response.json()) as WhatsAppSendMessageResponse
			const messageId = data.messages?.[0]?.id

			expect(messageId).toBeDefined()

			// Check if message is stored in memory store
			const storedMessages = mockStore.getMessagesForPhoneNumber(testPhoneId)
			const storedMessage = storedMessages.find(
				(msg: StoredMessage) => msg.id === messageId
			)

			expect(storedMessage).toBeDefined()
			expect(storedMessage?.type).toBe('template')
			expect(storedMessage?.content.template?.name).toBe('welcome_message')
		})
	})

	describe('Error Handling', () => {
		test('should handle malformed JSON', async () => {
			const response = await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: 'invalid json',
			})

			expect(response.status).toBe(400)
		})

		test('should handle webhook delivery failures gracefully', async () => {
			// Configure invalid webhook URL temporarily
			const originalUrl = process.env.WEBHOOK_URL
			process.env.WEBHOOK_URL = 'http://localhost:9999/invalid'

			const textMessage: WhatsAppSendMessageRequest = {
				messaging_product: 'whatsapp',
				to: '1234567890',
				type: 'text',
				text: {
					body: 'Test message with failing webhook',
				},
			}

			// API should still work even if webhook fails
			const response = await fetch(`${baseUrl}/v22.0/${testPhoneId}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify(textMessage),
			})

			expect(response.status).toBe(200)

			// Restore original webhook URL
			process.env.WEBHOOK_URL = originalUrl
		})
	})
})

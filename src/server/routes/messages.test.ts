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
import { mockStore, type StoredMessage } from '../store/memory-store.ts'
import { TemplateStore } from '../store/template-store.ts'
import type {
	WhatsAppErrorResponse,
	WhatsAppSendMessageRequest,
	WhatsAppSendMessageResponse,
} from '../types/api-types.ts'
import { createMessagesRouter } from './messages.ts'

describe('Messages API Integration Tests', () => {
	let server: ReturnType<typeof serve>
	let mockWebhookServer: ReturnType<typeof serve>
	let templateStore: TemplateStore
	const baseUrl = 'http://localhost:3014'
	const mockWebhookUrl = 'http://localhost:3015/webhook'
	const testPhoneId = '12345678901'

	// Store received webhook payloads for verification
	const receivedWebhooks: unknown[] = []

	beforeAll(async () => {
		// Set environment variable for webhook URL
		process.env.WEBHOOK_URL = mockWebhookUrl

		// Create and initialize template store for testing
		templateStore = new TemplateStore('./templates')
		await templateStore.initialize()

		// Set up test messages server
		const app = new Hono()
		app.use('*', cors())
		const messagesRouter = createMessagesRouter(templateStore)
		app.route('/v22.0/:phoneNumberId', messagesRouter)

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
		await templateStore?.cleanup()
	})

	beforeEach(() => {
		// Clear received webhooks and reset mocks before each test
		receivedWebhooks.length = 0
		vi.clearAllMocks()
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
				},
				body: JSON.stringify(invalidTemplateMessage),
			})

			expect(response.status).toBe(400)

			const data = (await response.json()) as WhatsAppErrorResponse
			expect(data.error.type).toBe('template_error')
			expect(data.error.message).toContain('not found')
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
				},
				body: JSON.stringify(textMessage),
			})

			expect(response.status).toBe(200)

			// Restore original webhook URL
			process.env.WEBHOOK_URL = originalUrl
		})
	})
})

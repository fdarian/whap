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
import { getWebhookUrl, setWebhookUrl } from '../config.ts'
import type {
	SimulateMessageParams,
	WebhookPayload,
	WhatsAppErrorResponse,
} from '../types/api-types.ts'
import { webhooksRouter } from './webhooks.ts'

describe('Webhooks API Integration Tests', () => {
	let server: ReturnType<typeof serve>
	let mockWebhookServer: ReturnType<typeof serve>
	const baseUrl = 'http://localhost:3012'
	const mockWebhookUrl = 'http://localhost:3013/webhook'
	const testPhoneId = '12345678901'
	const testBusinessId = 'test-business-123'

	// Store received webhook payloads for verification
	const receivedWebhooks: WebhookPayload[] = []

	beforeAll(async () => {
		// Set environment variable for webhook URL
		process.env.WEBHOOK_URL = mockWebhookUrl

		// Set up test webhook server
		const app = new Hono()
		app.use('*', cors())
		app.route('/', webhooksRouter)

		server = serve({
			fetch: app.fetch,
			port: 3012,
		})

		// Set up mock webhook endpoint to receive webhooks
		const mockApp = new Hono()
		mockApp.use('*', cors())

		// Mock webhook endpoint that stores received payloads
		mockApp.post('/webhook', async (c) => {
			const payload = await c.req.json()
			receivedWebhooks.push(payload)
			console.log('📥 Mock webhook received:', JSON.stringify(payload, null, 2))
			return c.json({ success: true })
		})

		mockWebhookServer = serve({
			fetch: mockApp.fetch,
			port: 3013,
		})

		// Wait for servers to start
		await new Promise((resolve) => setTimeout(resolve, 500))
	})

	afterAll(async () => {
		server?.close()
		mockWebhookServer?.close()
	})

	beforeEach(() => {
		// Clear received webhooks before each test
		receivedWebhooks.length = 0
		vi.clearAllMocks()
	})

	describe('Webhook Configuration', () => {
		test('should get webhook URL from environment', () => {
			expect(getWebhookUrl()).toBe(mockWebhookUrl)
		})

		test('should return fallback URL when no specific phone mapping exists', () => {
			const unconfiguredPhoneId = '99999999999'
			expect(getWebhookUrl(unconfiguredPhoneId)).toBe(mockWebhookUrl)
		})

		test('should handle missing webhook configuration', () => {
			// Temporarily clear the environment variable
			const originalUrl = process.env.WEBHOOK_URL
			process.env.WEBHOOK_URL = undefined

			// Reset config by creating a new instance (simulate no config)
			const result = getWebhookUrl('test')
			expect(result).toBeNull()

			// Restore the original URL
			process.env.WEBHOOK_URL = originalUrl
		})
	})

	describe('POST /simulate-message', () => {
		test('should simulate incoming message webhook', async () => {
			const simulateParams: SimulateMessageParams = {
				from: '1234567890',
				to: testPhoneId,
				message: {
					id: 'wamid.msg_test_123',
					type: 'text',
					timestamp: '1234567890',
					text: {
						body: 'Hello from test!',
					},
				},
			}

			const response = await fetch(`${baseUrl}/simulate-message`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(simulateParams),
			})

			expect(response.status).toBe(200)

			const data = await response.json()
			expect(data.success).toBe(true)
			expect(data.messageId).toBeDefined()
			expect(data.webhookUrl).toBe(mockWebhookUrl)

			// Wait for webhook to be delivered
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Verify webhook was received
			expect(receivedWebhooks).toHaveLength(1)
			const webhook = receivedWebhooks[0]

			expect(webhook.object).toBe('whatsapp_business_account')
			expect(webhook.entry).toHaveLength(1)
			expect(webhook.entry[0].id).toBe(testPhoneId)
			expect(webhook.entry[0].changes).toHaveLength(1)

			const change = webhook.entry[0].changes[0]
			expect(change.field).toBe('messages')
			expect(change.value.messaging_product).toBe('whatsapp')
			const valueWithMessages = change.value as {
				messages: Array<{
					from: string
					id: string
					type: string
					text: { body: string }
				}>
			}
			expect(valueWithMessages.messages).toHaveLength(1)

			const message = valueWithMessages.messages[0]
			expect(message.from).toBe(simulateParams.from)
			expect(message.id).toBe(simulateParams.message.id)
			expect(message.type).toBe('text')
			expect(message.text.body).toBe(simulateParams.message.text.body)
		})

		test('should return error when from is missing', async () => {
			const invalidParams = {
				to: testPhoneId,
				message: {
					id: 'wamid.msg_test_123',
					type: 'text',
					timestamp: '1234567890',
					text: { body: 'Test message' },
				},
			}

			const response = await fetch(`${baseUrl}/simulate-message`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(invalidParams),
			})

			expect(response.status).toBe(400)

			const data = (await response.json()) as WhatsAppErrorResponse
			expect(data.error.message).toBe('from is required')
			expect(data.error.type).toBe('validation_error')
		})

		test('should return error when to is missing', async () => {
			const invalidParams = {
				from: '1234567890',
				message: {
					id: 'wamid.msg_test_123',
					type: 'text',
					timestamp: '1234567890',
					text: { body: 'Test message' },
				},
			}

			const response = await fetch(`${baseUrl}/simulate-message`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(invalidParams),
			})

			expect(response.status).toBe(400)

			const data = (await response.json()) as WhatsAppErrorResponse
			expect(data.error.message).toBe('to (phone number ID) is required')
			expect(data.error.type).toBe('validation_error')
		})

		test('should return error when message.text.body is missing', async () => {
			const invalidParams = {
				from: '1234567890',
				to: testPhoneId,
				message: {
					id: 'wamid.msg_test_123',
					type: 'text',
					timestamp: '1234567890',
					text: {}, // Missing body
				},
			}

			const response = await fetch(`${baseUrl}/simulate-message`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(invalidParams),
			})

			expect(response.status).toBe(400)

			const data = (await response.json()) as WhatsAppErrorResponse
			expect(data.error.message).toBe('message.text.body is required')
			expect(data.error.type).toBe('validation_error')
		})

		test('should return error when webhook URL is not configured', async () => {
			const unconfiguredPhoneId = '99999999999'
			const simulateParams: SimulateMessageParams = {
				from: '1234567890',
				to: unconfiguredPhoneId,
				message: {
					id: 'wamid.msg_test_123',
					type: 'text',
					timestamp: '1234567890',
					text: { body: 'Test message' },
				},
			}

			const response = await fetch(`${baseUrl}/simulate-message`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(simulateParams),
			})

			expect(response.status).toBe(400)

			const data = (await response.json()) as WhatsAppErrorResponse
			expect(data.error.message).toContain('No webhook URL configured')
			expect(data.error.type).toBe('webhook_not_configured')
		})
	})

	describe('POST /trigger', () => {
		test('should trigger webhook event', async () => {
			const triggerData = {
				phone: testPhoneId,
				message: 'Test webhook trigger',
			}

			const response = await fetch(`${baseUrl}/trigger`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(triggerData),
			})

			expect(response.status).toBe(200)

			const data = await response.json()
			expect(data.success).toBe(true)
			expect(data.eventId).toBeDefined()
		})

		test('should handle malformed JSON', async () => {
			const response = await fetch(`${baseUrl}/trigger`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: 'invalid json',
			})

			expect(response.status).toBe(400)
		})
	})

	describe('Error Handling', () => {
		test('should handle webhook delivery failure gracefully', async () => {
			// Configure webhook URL to non-existent endpoint
			const invalidWebhookUrl = 'http://localhost:9999/webhook'
			setWebhookUrl(testPhoneId, invalidWebhookUrl)

			const simulateParams: SimulateMessageParams = {
				from: '1234567890',
				to: testPhoneId,
				message: {
					id: 'wamid.msg_test_123',
					type: 'text',
					timestamp: '1234567890',
					text: { body: 'Test message' },
				},
			}

			// Should still return success even if webhook delivery fails
			const response = await fetch(`${baseUrl}/simulate-message`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(simulateParams),
			})

			expect(response.status).toBe(200)

			const data = await response.json()
			expect(data.success).toBe(true)
			expect(data.webhookUrl).toBe(invalidWebhookUrl)

			// Restore valid webhook URL
			setWebhookUrl(testPhoneId, mockWebhookUrl)
		})
	})
})

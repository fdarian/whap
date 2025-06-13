import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { mockStore } from '../store/memory-store.ts'
import type {
	SimulateMessageParams,
	WebhookConfiguration,
	WebhookPayload,
	WhatsAppErrorResponse,
} from '../types/api-types.ts'

const webhooksRouter = new Hono()

// Get webhook URL from environment variable
const getWebhookUrl = (): string | null => {
	return process.env.WEBHOOK_URL || null
}

// Configure webhook URL for a phone number
webhooksRouter.post(
	'/configure',
	validator('json', (value, c) => {
		const body = value as WebhookConfiguration

		if (!body.phoneNumberId) {
			return c.json(
				{
					error: {
						message: 'phoneNumberId is required',
						type: 'validation_error',
						code: 400,
					},
				} as WhatsAppErrorResponse,
				400
			)
		}

		if (!body.url) {
			return c.json(
				{
					error: {
						message: 'url is required',
						type: 'validation_error',
						code: 400,
					},
				} as WhatsAppErrorResponse,
				400
			)
		}

		try {
			new URL(body.url) // Validate URL format
		} catch {
			return c.json(
				{
					error: {
						message: 'Invalid URL format',
						type: 'validation_error',
						code: 400,
					},
				} as WhatsAppErrorResponse,
				400
			)
		}

		return body
	}),
	async (c) => {
		const config = c.req.valid('json') as WebhookConfiguration

		// Store webhook configuration
		mockStore.setWebhookConfig(config.phoneNumberId, config)

		console.log(
			`🔗 Configured webhook for ${config.phoneNumberId}: ${config.url}`
		)

		return c.json({
			success: true,
			message: `Webhook configured for phone number ${config.phoneNumberId}`,
			config,
		})
	}
)

// Get webhook configuration for a phone number
webhooksRouter.get('/configure/:phoneNumberId', (c) => {
	const phoneNumberId = c.req.param('phoneNumberId')
	const config = mockStore.getWebhookConfig(phoneNumberId)

	if (!config) {
		return c.json(
			{
				error: {
					message: 'Webhook configuration not found',
					type: 'not_found',
					code: 404,
				},
			} as WhatsAppErrorResponse,
			404
		)
	}

	return c.json(config)
})

// Get current webhook URL from environment
webhooksRouter.get('/config', (c) => {
	const webhookUrl = getWebhookUrl()
	return c.json({
		webhookUrl,
		configured: !!webhookUrl,
		source: 'environment_variable',
	})
})

// Get all webhook configurations (legacy)
webhooksRouter.get('/configure', (c) => {
	const configs = mockStore.getAllWebhookConfigs()
	return c.json({ webhooks: configs })
})

// Simulate incoming message (triggers webhook)
webhooksRouter.post(
	'/simulate-message',
	validator('json', (value, c) => {
		const body = value as SimulateMessageParams

		if (!body.from) {
			return c.json(
				{
					error: {
						message: 'from is required',
						type: 'validation_error',
						code: 400,
					},
				} as WhatsAppErrorResponse,
				400
			)
		}

		if (!body.to) {
			return c.json(
				{
					error: {
						message: 'to (phone number ID) is required',
						type: 'validation_error',
						code: 400,
					},
				} as WhatsAppErrorResponse,
				400
			)
		}

		if (!body.message || !body.message.text || !body.message.text.body) {
			return c.json(
				{
					error: {
						message: 'message.text.body is required',
						type: 'validation_error',
						code: 400,
					},
				} as WhatsAppErrorResponse,
				400
			)
		}

		return body
	}),
	async (c) => {
		const params = c.req.valid('json') as SimulateMessageParams

		// Get webhook URL from environment variable
		const webhookUrl = getWebhookUrl()

		if (!webhookUrl) {
			return c.json(
				{
					error: {
						message:
							'No webhook URL configured. Set WEBHOOK_URL environment variable.',
						type: 'webhook_not_configured',
						code: 400,
					},
				} as WhatsAppErrorResponse,
				400
			)
		}

		// Store the webhook message
		const storedMessage = mockStore.storeWebhookMessage(params)

		// Create webhook payload
		const payload: WebhookPayload = {
			object: 'whatsapp_business_account',
			entry: [
				{
					id: params.to,
					changes: [
						{
							value: {
								messaging_product: 'whatsapp',
								metadata: {
									display_phone_number: params.to,
									phone_number_id: params.to,
								},
								contacts: [
									{
										profile: {
											name: `User ${params.from}`,
										},
										wa_id: params.from,
									},
								],
								messages: [
									{
										from: params.from,
										id: params.message.id,
										timestamp: params.message.timestamp,
										type: 'text',
										text: {
											body: params.message.text.body,
										},
									},
								],
							},
							field: 'messages',
						},
					],
				},
			],
		}

		console.log(
			`Simulating incoming message from ${params.from} to ${params.to}`
		)
		console.log(`🔗 Sending webhook to: ${webhookUrl}`)

		// Send webhook (fire and forget)
		sendWebhook(webhookUrl, payload).catch((error) => {
			console.error(`❌ Webhook delivery failed: ${error.message}`)
		})

		return c.json({
			success: true,
			message: 'Webhook message simulated and sent',
			messageId: storedMessage.id,
			webhookUrl,
		})
	}
)

// Get mock server stats
webhooksRouter.get('/stats', (c) => {
	const stats = mockStore.getStats()
	return c.json(stats)
})

// Clear all mock data
webhooksRouter.delete('/clear', (c) => {
	mockStore.clear()
	return c.json({
		success: true,
		message: 'All mock data cleared',
	})
})

// Get conversation history
webhooksRouter.get('/conversation/:phoneNumberId/:otherNumber', (c) => {
	const phoneNumberId = c.req.param('phoneNumberId')
	const otherNumber = c.req.param('otherNumber')

	const conversation = mockStore.getConversation(phoneNumberId, otherNumber)

	return c.json({
		phoneNumberId,
		otherNumber,
		messages: conversation,
	})
})

// GET /webhook/events - Get webhook events
webhooksRouter.get('/events', (c) => {
	const events = mockStore.getAllWebhookEvents()
	return c.json(events)
})

// POST /webhook/trigger - Trigger a webhook
webhooksRouter.post('/trigger', async (c) => {
	const body = await c.req.json()
	const { phone, message } = body

	// Store webhook event
	const event = mockStore.storeWebhookEvent({
		timestamp: new Date(),
		payload: { phone, message },
		url: 'mock://trigger',
		status: 'delivered',
	})

	console.log(`🔗 Triggered webhook for ${phone}: ${message}`)
	return c.json({ success: true, eventId: event.id })
})

// DELETE /webhook/events - Clear webhook events
webhooksRouter.delete('/events', (c) => {
	mockStore.clearWebhookEvents()
	return c.json({ success: true })
})

// Helper function to send webhook
async function sendWebhook(
	url: string,
	payload: WebhookPayload
): Promise<void> {
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'WhatsApp-Mock-Server/1.0',
			},
			body: JSON.stringify(payload),
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`)
		}

		console.log(`✅ Webhook delivered successfully to ${url}`)
	} catch (error) {
		console.error(`❌ Failed to deliver webhook to ${url}:`, error)
		throw error
	}
}

export { webhooksRouter }

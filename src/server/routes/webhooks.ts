import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { getAllWebhookMappings, getWebhookUrl } from '../config.ts'
import { mockStore } from '../store/memory-store.ts'
import type {
	SimulateMessageParams,
	WebhookConfiguration,
	WebhookPayload,
	WhatsAppErrorResponse,
} from '../types/api-types.ts'
import { processMediaFile } from '../utils/media-utils.ts'

const webhooksRouter = new Hono()

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

// Get current webhook configuration
webhooksRouter.get('/config', (c) => {
	const fallbackUrl = getWebhookUrl()
	const mappings = getAllWebhookMappings()

	return c.json({
		fallbackUrl,
		mappings,
		configured: !!fallbackUrl || mappings.length > 0,
		sources: {
			environment: !!fallbackUrl,
			cli_mappings: mappings.length > 0,
		},
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

		if (!body.message) {
			return c.json(
				{
					error: {
						message: 'message is required',
						type: 'validation_error',
						code: 400,
					},
				} as WhatsAppErrorResponse,
				400
			)
		}

		// Validate based on message type
		if (body.message.type === 'text') {
			if (!body.message.text || !body.message.text.body) {
				return c.json(
					{
						error: {
							message: 'message.text.body is required for text messages',
							type: 'validation_error',
							code: 400,
						},
					} as WhatsAppErrorResponse,
					400
				)
			}
		} else {
			// Media message validation
			if (!body.message.filePath) {
				return c.json(
					{
						error: {
							message: 'message.filePath is required for media messages',
							type: 'validation_error',
							code: 400,
						},
					} as WhatsAppErrorResponse,
					400
				)
			}
		}

		return body
	}),
	async (c) => {
		const params = c.req.valid('json') as SimulateMessageParams

		// Get webhook URL for the specific phone number
		// Check store-based webhook config first, then fall back to CLI/env config
		const storeConfig = mockStore.getWebhookConfig(params.to)
		const webhookUrl = storeConfig?.url || getWebhookUrl(params.to)

		if (!webhookUrl) {
			console.warn(
				`⚠️  No webhook URL configured for phone number ${params.to}. Skipping webhook delivery for testing.`
			)
		}

		let mediaMetadata = undefined

		// Process media file if it's a media message
		if (params.message.type !== 'text') {
			try {
				mediaMetadata = processMediaFile(
					params.message.filePath,
					params.message.caption
				)
				console.log(`📎 Processed media file: ${mediaMetadata.filename}`)

				// Store media file in mockStore
				const storedMediaFile = mockStore.storeMediaFile({
					filePath: mediaMetadata.storedPath,
					filename: mediaMetadata.filename,
					mimeType: mediaMetadata.mimeType,
					fileSize: mediaMetadata.size,
					phoneNumberId: params.to,
					status: 'processed',
				})

				// Update mediaMetadata with the stored media ID
				mediaMetadata.id = storedMediaFile.id
			} catch (error) {
				return c.json(
					{
						error: {
							message: `File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
							type: 'file_error',
							code: 400,
						},
					} as WhatsAppErrorResponse,
					400
				)
			}
		}

		// Store the webhook message
		const storedMessage = mockStore.storeWebhookMessage(params)

		// Create webhook payload based on message type
		let messagePayload: {
			from: string
			id: string
			timestamp: string
			type: string
			text?: { body: string }
			image?: { id: string; mime_type: string; caption?: string }
			document?: {
				id: string
				mime_type: string
				filename: string
				caption?: string
			}
			audio?: { id: string; mime_type: string; caption?: string }
			video?: { id: string; mime_type: string; caption?: string }
			sticker?: { id: string; mime_type: string }
		}

		if (params.message.type === 'text') {
			messagePayload = {
				from: params.from,
				id: params.message.id,
				timestamp: params.message.timestamp,
				type: 'text',
				text: {
					body: params.message.text.body,
				},
			}
		} else {
			// Media message payload - mediaMetadata is guaranteed to exist here
			if (!mediaMetadata) {
				throw new Error('Media metadata is required for media messages')
			}

			const mediaType = params.message.type
			const baseMediaObj = {
				id: mediaMetadata.id,
				mime_type: mediaMetadata.mimeType,
				...(mediaMetadata.caption && { caption: mediaMetadata.caption }),
			}

			messagePayload = {
				from: params.from,
				id: params.message.id,
				timestamp: params.message.timestamp,
				type: mediaType,
				...(mediaType === 'image' && { image: baseMediaObj }),
				...(mediaType === 'document' && {
					document: { ...baseMediaObj, filename: mediaMetadata.filename },
				}),
				...(mediaType === 'audio' && { audio: baseMediaObj }),
				...(mediaType === 'video' && { video: baseMediaObj }),
				...(mediaType === 'sticker' && {
					sticker: { id: mediaMetadata.id, mime_type: mediaMetadata.mimeType },
				}),
			}
		}

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
								messages: [messagePayload],
							},
							field: 'messages',
						},
					],
				},
			],
		}

		console.log(
			`Simulating incoming ${params.message.type} message from ${params.from} to ${params.to}`
		)

		// Send webhook only if URL is configured
		if (webhookUrl) {
			console.log(`🔗 Sending webhook to: ${webhookUrl}`)
			sendWebhook(webhookUrl, payload).catch((error) => {
				console.error(`❌ Webhook delivery failed: ${error.message}`)
			})
		}

		return c.json({
			success: true,
			message: `Webhook ${params.message.type} message simulated and sent`,
			messageId: storedMessage.id,
			...(mediaMetadata && { mediaId: mediaMetadata.id }),
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

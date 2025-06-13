import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { getWebhookUrl } from '../config.ts'
import { mockStore } from '../store/memory-store.ts'
import type { StoredMessage } from '../store/memory-store.ts'
import { templateStore } from '../store/template-store.ts'
import type { Template } from '../store/template-store.ts'
import type {
	WebhookPayload,
	WhatsAppErrorResponse,
	WhatsAppSendMessageRequest,
	WhatsAppSendMessageResponse,
	WhatsAppTypingRequest,
	WhatsAppTypingResponse,
} from '../types/api-types.ts'
import {
	formatValidationErrorForAPI,
	validateWhatsAppMessageRequest,
	validateWhatsAppTypingRequest,
} from '../utils/validator.ts'
import { broadcast } from '../websocket.ts'

const messagesRouter = new Hono()

/** Process template with variable substitution */
export function processTemplate(
	templateName: string,
	language: string,
	parameters: Array<{
		type: 'text'
		parameter_name: string
		text: string
	}>
): { processedTemplate: Template | null; error?: string } {
	// Get template from store
	const template = templateStore.getTemplate(templateName, language)
	if (!template) {
		return {
			processedTemplate: null,
			error: `Template "${templateName}" with language "${language}" not found`,
		}
	}

	// Create a map of parameter values by name/index
	const paramMap = new Map<string, string>()
	for (const param of parameters) {
		paramMap.set(param.parameter_name, param.text)
	}

	// Process each component and substitute variables
	const processedComponents = template.components.map((component) => {
		if (component.text) {
			// Replace both {{n}} and {{name}} placeholders with actual values
			let processedText = component.text
			const placeholderRegex = /\{\{([^}]+)\}\}/g

			processedText = processedText.replace(
				placeholderRegex,
				(match, paramName) => {
					const value = paramMap.get(paramName)
					if (value !== undefined) {
						return value
					}
					// If parameter not found, keep the placeholder
					console.warn(
						`Template parameter ${paramName} not provided, keeping placeholder`
					)
					return match
				}
			)

			return {
				...component,
				text: processedText,
			}
		}
		return component
	})

	return {
		processedTemplate: {
			...template,
			components: processedComponents,
		},
		error: undefined,
	}
}

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

/** Enhanced delivery status webhook supporting template-specific data */
function sendDeliveryStatusWebhook(
	messageId: string,
	phoneNumberId: string,
	to: string,
	status: 'sent' | 'delivered' | 'read' | 'failed',
	templateData?: {
		name: string
		language: string
		category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
		error?: {
			code: string
			title: string
			message: string
			details?: string
		}
	}
): void {
	const webhookUrl = getWebhookUrl(phoneNumberId)
	if (!webhookUrl) return

	const baseStatus = {
		id: messageId,
		status,
		timestamp: Math.floor(Date.now() / 1000).toString(),
		recipient_id: to,
		conversation: {
			id: `conversation_${messageId}`,
			expiration_timestamp: Math.floor(Date.now() / 1000 + 86400).toString(), // 24 hours
			origin: {
				type: 'business_initiated',
			},
		},
		pricing: {
			category:
				templateData?.category === 'AUTHENTICATION'
					? 'authentication'
					: 'utility',
			pricing_model: 'CBP',
		},
	}

	const payload: WebhookPayload = {
		object: 'whatsapp_business_account',
		entry: [
			{
				id: phoneNumberId,
				changes: [
					{
						value: {
							messaging_product: 'whatsapp',
							metadata: {
								display_phone_number: phoneNumberId,
								phone_number_id: phoneNumberId,
							},
							// Use template_statuses for template messages, statuses for regular messages
							...(templateData
								? {
										template_statuses: [
											{
												...baseStatus,
												template: {
													name: templateData.name,
													language: templateData.language,
													category: templateData.category || 'UTILITY',
												},
												...(templateData.error && {
													error: templateData.error,
												}),
											},
										],
									}
								: {
										statuses: [baseStatus],
									}),
						},
						field: 'messages',
					},
				],
			},
		],
	}

	const messageType = templateData ? 'template' : 'text'
	console.log(
		`📤 Sending ${status} webhook for ${messageType} message ${messageId}`
	)

	sendWebhook(webhookUrl, payload).catch((error) => {
		console.error(`❌ Delivery status webhook failed: ${error.message}`)
	})
}

/** Send template status update webhook for approval/rejection events */
function sendTemplateStatusWebhook(
	phoneNumberId: string,
	templateData: {
		id: string
		name: string
		language: string
		category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
		event: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'
		reason?: string
		status_details?: string
		errors?: Array<{
			code: string
			title: string
			message: string
			error_data?: {
				component_index?: number
				button_position?: number
				details?: string
			}
		}>
	}
): void {
	const webhookUrl = getWebhookUrl(phoneNumberId)
	if (!webhookUrl) return

	const payload: WebhookPayload = {
		object: 'whatsapp_business_account',
		entry: [
			{
				id: phoneNumberId,
				changes: [
					{
						value: {
							messaging_product: 'whatsapp',
							metadata: {
								display_phone_number: phoneNumberId,
								phone_number_id: phoneNumberId,
							},
							event: templateData.event,
							message_template_id: templateData.id,
							message_template_name: templateData.name,
							message_template_language: templateData.language,
							category: templateData.category,
							timestamp: Math.floor(Date.now() / 1000).toString(),
							...(templateData.reason && { reason: templateData.reason }),
							...(templateData.status_details && {
								status_details: templateData.status_details,
							}),
							...(templateData.errors && { errors: templateData.errors }),
						},
						field: 'message_template_status_update',
					},
				],
			},
		],
	}

	console.log(
		`📋 Sending template ${templateData.event} webhook for template ${templateData.name}`
	)

	sendWebhook(webhookUrl, payload).catch((error) => {
		console.error(`❌ Template status webhook failed: ${error.message}`)
	})
}

/** Check if request is a typing indicator using JSON schema validation */
function isTypingIndicatorRequest(
	body: unknown
): body is WhatsAppTypingRequest {
	const typingResult = validateWhatsAppTypingRequest(body)
	return typingResult.isValid
}

/** Validation middleware for send message request using Ajv */
const validateSendMessage = validator('json', (value, c) => {
	// First try to validate as a typing indicator request
	const typingResult = validateWhatsAppTypingRequest(value)
	if (typingResult.isValid && typingResult.data) {
		return typingResult.data
	}

	// Then try to validate as a message request
	const messageResult = validateWhatsAppMessageRequest(value)
	if (messageResult.isValid && messageResult.data) {
		return messageResult.data
	}

	// If neither validation passes, return error response
	const errorMessage = formatValidationErrorForAPI(
		messageResult.errors || [
			{ path: 'root', message: 'Invalid request format' },
		]
	)

	return c.json(
		{
			error: {
				message: errorMessage,
				type: 'validation_error',
				code: 400,
			},
		} as WhatsAppErrorResponse,
		400
	)
})

// POST /v22.0/{phone-number-id}/messages - Send message or typing indicator
messagesRouter.post(
	'/:phoneNumberId/messages',
	validateSendMessage,
	async (c) => {
		const { phoneNumberId } = c.req.param()
		const body = c.req.valid('json')

		// Check if this is a typing indicator request
		if (isTypingIndicatorRequest(body)) {
			console.log(
				`⌨️ Typing indicator for message ${body.message_id} on ${phoneNumberId}`
			)

			// Store typing status temporarily (will expire after 25 seconds)
			mockStore.setTypingIndicator(phoneNumberId, body.message_id, true)

			// Broadcast typing status to CLI
			broadcast({
				type: 'TYPING_INDICATOR',
				payload: {
					phoneNumberId,
					messageId: body.message_id,
					isTyping: true,
					timestamp: Date.now(),
				},
			})

			// Auto-clear typing indicator after 25 seconds (as per WhatsApp specs)
			setTimeout(() => {
				mockStore.setTypingIndicator(phoneNumberId, body.message_id, false)
				broadcast({
					type: 'TYPING_INDICATOR',
					payload: {
						phoneNumberId,
						messageId: body.message_id,
						isTyping: false,
						timestamp: Date.now(),
					},
				})
			}, 25000)

			const response: WhatsAppTypingResponse = {
				success: true,
			}

			return c.json(response)
		}

		// Otherwise handle as regular message
		const messageBody = body as WhatsAppSendMessageRequest

		// Process template if present
		let processedContent: StoredMessage['content'] = {
			...(messageBody.text && { text: messageBody.text }),
			...(messageBody.template && { template: messageBody.template }),
		}

		if (messageBody.template) {
			const templateProcessingResult = processTemplate(
				messageBody.template.name,
				messageBody.template.language.code,
				messageBody.template.components?.[0]?.parameters || []
			)

			if (templateProcessingResult.error) {
				console.error(
					`❌ Template processing error: ${templateProcessingResult.error}`
				)
				return c.json(
					{
						error: {
							message: templateProcessingResult.error,
							type: 'template_error',
							code: 400,
						},
					} as WhatsAppErrorResponse,
					400
				)
			}

			// Store the processed template in the content
			processedContent = {
				...processedContent,
				processedTemplate:
					templateProcessingResult.processedTemplate || undefined,
			}

			console.log(
				`✅ Template "${messageBody.template.name}" processed successfully`
			)
		}

		// Store the message
		const storedMessage = mockStore.storeMessage({
			phoneNumberId,
			to: messageBody.to,
			type: messageBody.type,
			content: processedContent,
		})

		// Broadcast that a new message was sent
		broadcast({
			type: 'NEW_MESSAGE',
			payload: storedMessage,
		})

		// Prepare template data for webhooks if it's a template message
		const templateWebhookData = messageBody.template
			? {
					name: messageBody.template.name,
					language: messageBody.template.language.code,
					category: 'UTILITY' as const, // Default category - could be enhanced to detect from template
				}
			: undefined

		// Prepare response early for potential early returns
		const response: WhatsAppSendMessageResponse = {
			messaging_product: 'whatsapp',
			contacts: [{ input: messageBody.to, wa_id: messageBody.to }],
			messages: [
				{
					id: storedMessage.id,
				},
			],
		}

		// Simulate template approval/rejection process for new templates
		if (messageBody.template) {
			const template = messageBody.template // Extract for type safety
			// Simulate template approval process with random outcomes for demonstration
			const shouldApprove = Math.random() > 0.1 // 90% approval rate
			const shouldFail = Math.random() > 0.95 // 5% delivery failure rate

			// Simulate template approval workflow
			setTimeout(() => {
				if (shouldApprove) {
					sendTemplateStatusWebhook(phoneNumberId, {
						id: `template_${Date.now()}`,
						name: template.name,
						language: template.language.code,
						category: 'UTILITY',
						event: 'APPROVED',
						status_details: 'Template approved and ready for use',
					})
				} else {
					sendTemplateStatusWebhook(phoneNumberId, {
						id: `template_${Date.now()}`,
						name: template.name,
						language: template.language.code,
						category: 'UTILITY',
						event: 'REJECTED',
						reason: 'POLICY_VIOLATION',
						status_details: 'Template rejected due to policy compliance issues',
						errors: [
							{
								code: 'INVALID_CONTENT',
								title: 'Content Policy Violation',
								message:
									'Template content does not comply with WhatsApp policies',
								error_data: {
									details:
										'Please review template content for promotional language',
								},
							},
						],
					})
				}
			}, 500) // Approval happens before delivery

			// Simulate delivery failure for templates with policy issues
			if (shouldFail) {
				setTimeout(() => {
					mockStore.updateMessageStatus(storedMessage.id, 'sent')
					if (templateWebhookData) {
						sendDeliveryStatusWebhook(
							storedMessage.id,
							phoneNumberId,
							messageBody.to,
							'failed',
							{
								name: templateWebhookData.name,
								language: templateWebhookData.language,
								category: templateWebhookData.category,
								error: {
									code: 'TEMPLATE_REJECTED',
									title: 'Template Message Failed',
									message:
										'Message could not be delivered due to template policy violation',
									details:
										'Template has been paused due to low acceptance rate',
								},
							}
						)
					}
				}, 1500)

				// Skip normal delivery flow for failed messages
				return c.json(response)
			}
		}

		// Simulate webhook for delivery status (sent -> delivered -> read)
		setTimeout(
			() =>
				sendDeliveryStatusWebhook(
					storedMessage.id,
					phoneNumberId,
					messageBody.to,
					'sent',
					templateWebhookData
				),
			1000
		)

		setTimeout(() => {
			mockStore.updateMessageStatus(storedMessage.id, 'delivered')
			sendDeliveryStatusWebhook(
				storedMessage.id,
				phoneNumberId,
				messageBody.to,
				'delivered',
				templateWebhookData
			)
		}, 2000)

		setTimeout(() => {
			mockStore.updateMessageStatus(storedMessage.id, 'read')
			sendDeliveryStatusWebhook(
				storedMessage.id,
				phoneNumberId,
				messageBody.to,
				'read',
				templateWebhookData
			)
		}, 3000)

		// Response was already prepared above

		return c.json(response)
	}
)

// POST /v22.0/{phone-number-id}/typing - Send typing indicator (dedicated endpoint)
messagesRouter.post('/:phoneNumberId/typing', async (c) => {
	try {
		const body = (await c.req.json()) as WhatsAppTypingRequest
		const phoneNumberId = c.req.param('phoneNumberId')

		// Validate typing request
		if (body.status === 'read' && body.message_id && body.typing_indicator) {
			console.log(
				`⌨️ Typing indicator for message ${body.message_id} on ${phoneNumberId}`
			)

			// Store typing status temporarily (will expire after 25 seconds)
			mockStore.setTypingIndicator(phoneNumberId, body.message_id, true)

			// Broadcast typing status to CLI
			broadcast({
				type: 'TYPING_INDICATOR',
				payload: {
					phoneNumberId,
					messageId: body.message_id,
					isTyping: true,
					timestamp: Date.now(),
				},
			})

			// Auto-clear typing indicator after 25 seconds (as per WhatsApp specs)
			setTimeout(() => {
				mockStore.setTypingIndicator(phoneNumberId, body.message_id, false)
				broadcast({
					type: 'TYPING_INDICATOR',
					payload: {
						phoneNumberId,
						messageId: body.message_id,
						isTyping: false,
						timestamp: Date.now(),
					},
				})
			}, 25000)

			const response: WhatsAppTypingResponse = {
				success: true,
			}

			return c.json(response)
		}
		return c.json(
			{
				error: {
					message: 'Invalid typing indicator request format',
					type: 'validation_error',
					code: 400,
				},
			} as WhatsAppErrorResponse,
			400
		)
	} catch (error) {
		console.error('❌ Typing indicator error:', error)
		return c.json(
			{
				error: {
					message: 'Failed to process typing indicator',
					type: 'server_error',
					code: 500,
				},
			} as WhatsAppErrorResponse,
			500
		)
	}
})

// GET /v22.0/{phone-number-id}/messages - Get messages (mock endpoint for testing)
messagesRouter.get('/:phoneNumberId/messages', (c) => {
	const phoneNumberId = c.req.param('phoneNumberId')
	const messages = mockStore.getMessagesForPhoneNumber(phoneNumberId)

	return c.json({
		data: messages,
		paging: {
			cursors: {
				before: 'mock-cursor-before',
				after: 'mock-cursor-after',
			},
		},
	})
})

// GET /v22.0/{phone-number-id}/messages/{message-id} - Get specific message
messagesRouter.get('/:phoneNumberId/messages/:messageId', (c) => {
	const messageId = c.req.param('messageId')
	const message = mockStore.getMessage(messageId)

	if (!message) {
		return c.json(
			{
				error: {
					message: 'Message not found',
					type: 'not_found',
					code: 404,
				},
			} as WhatsAppErrorResponse,
			404
		)
	}

	return c.json(message)
})

export { messagesRouter }

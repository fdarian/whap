import ky from 'ky'
import { v4 as uuidv4 } from 'uuid'

export interface Message {
	id: string
	to: string
	from: string
	text: string
	timestamp: Date
	direction: 'sent' | 'received'
}

export interface ConversationHistory {
	messages: Message[]
	participants: string[]
}

export interface ServerStatus {
	connected: boolean
	uptime: number
	messageCount: number
}

/** Template component structure based on WhatsApp Business API format */
export interface TemplateComponent {
	type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
	format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
	text?: string
	buttons?: Array<{
		type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
		text: string
		url?: string
		phone_number?: string
	}>
}

/** Template structure based on WhatsApp Business API format */
export interface Template {
	name: string
	language: string
	category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
	components: TemplateComponent[]
	variables?: Record<
		string,
		{
			description: string
			example: string
		}
	>
}

export class ApiClient {
	private baseUrl
	private client

	constructor(baseUrl = `http://localhost:${process.env.PORT ?? 3010}`) {
		this.baseUrl = baseUrl
		this.client = ky.create({
			prefixUrl: baseUrl,
			timeout: 5000,
			retry: 2,
		})
	}

	async getStatus(): Promise<ServerStatus> {
		const response = await this.client.get('status').json<ServerStatus>()
		return response
	}

	async sendMessage(
		from: string,
		to: string,
		text: string
	): Promise<{ messageId: string }> {
		const messageId = uuidv4()
		const payload = {
			from: from,
			to: to,
			message: {
				id: messageId,
				type: 'text',
				timestamp: Math.floor(Date.now() / 1000).toString(),
				text: {
					body: text,
				},
			},
		}

		try {
			// Simulate incoming user message via webhook
			await this.client.post('mock/simulate-message', {
				json: payload,
			})
		} catch (error) {
			console.error('Error sending message:', error)
		}

		return { messageId }
	}

	async sendTemplateMessage(
		from: string,
		to: string,
		templateName: string,
		parameters: string[] = []
	): Promise<{ messageId: string }> {
		const messageId = uuidv4()
		const payload = {
			messaging_product: 'whatsapp',
			to,
			type: 'template',
			template: {
				name: templateName,
				language: { code: 'en_US' },
				components:
					parameters.length > 0
						? [
								{
									type: 'body',
									parameters: parameters.map((param) => ({
										type: 'text',
										text: param,
									})),
								},
							]
						: [],
			},
		}

		await this.client.post(`v22.0/${from}/messages`, {
			json: payload,
		})

		return { messageId }
	}

	async getConversationHistory(
		from?: string,
		to?: string
	): Promise<ConversationHistory> {
		const searchParams: Record<string, string> = {}
		if (from) searchParams.from = from
		if (to) searchParams.to = to

		const response = await this.client
			.get('conversation', {
				...(Object.keys(searchParams).length > 0 && { searchParams }),
			})
			.json<{
				messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }>
				participants: string[]
			}>()

		// Convert timestamp strings back to Date objects
		const messages = response.messages.map((msg) => ({
			...msg,
			timestamp: new Date(msg.timestamp),
		}))

		return {
			messages,
			participants: response.participants,
		}
	}

	async clearConversation(): Promise<void> {
		await this.client.delete('conversation')
	}

	async getStats(): Promise<{
		totalMessages: number
		uptime: number
		lastActivity: Date | null
	}> {
		const response = await this.client.get('stats').json<{
			totalMessages: number
			uptime: number
			lastActivity: string | null
		}>()

		return {
			...response,
			lastActivity: response.lastActivity
				? new Date(response.lastActivity)
				: null,
		}
	}

	async simulateIncomingMessage(
		phoneNumberId: string,
		from: string,
		messageBody: string
	): Promise<{ messageId: string }> {
		const payload = {
			to: phoneNumberId,
			from: from,
			message: {
				id: uuidv4(),
				type: 'text',
				timestamp: Math.floor(Date.now() / 1000).toString(),
				text: {
					body: messageBody,
				},
			},
		}

		try {
			// Simulate incoming user message via webhook
			await this.client.post('mock/simulate-message', {
				json: payload,
			})
		} catch (error) {
			console.error('Error sending message:', error)
		}

		return { messageId: payload.message.id }
	}

	async sendTypingIndicator(
		phoneNumberId: string,
		messageId: string
	): Promise<{ success: boolean }> {
		const payload = {
			messaging_product: 'whatsapp',
			status: 'read',
			message_id: messageId,
			typing_indicator: {
				type: 'text',
			},
		}

		try {
			// Try the standard WhatsApp Cloud API messages endpoint first
			// This matches the external service implementation
			const response = await this.client
				.post(`v22.0/${phoneNumberId}/messages`, {
					json: payload,
				})
				.json<{ success: boolean }>()

			return response
		} catch (error) {
			console.error('Error sending typing indicator:', error)
			throw error
		}
	}

	/** Get all available templates */
	async getTemplates(businessAccountId = 'test'): Promise<Template[]> {
		try {
			const response = await this.client
				.get(`v22.0/${businessAccountId}/message_templates`)
				.json<{ data: Template[] }>()

			return response.data
		} catch (error) {
			console.error('Error fetching templates:', error)
			return []
		}
	}

	/** Get a specific template by name and language */
	async getTemplate(
		templateName: string,
		language = 'en',
		businessAccountId = 'test'
	): Promise<Template | null> {
		try {
			const response = await this.client
				.get(`v22.0/${businessAccountId}/message_templates/${templateName}`, {
					searchParams: { language },
				})
				.json<Template>()

			return response
		} catch (error) {
			console.error(`Error fetching template ${templateName}:`, error)
			return null
		}
	}
}

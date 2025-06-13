import type {
	SimulateMessageParams,
	WebhookConfiguration,
} from '../types/api-types.ts'
import type { Template } from './template-store.ts'

export interface StoredMessage {
	id: string
	phoneNumberId: string
	to: string
	type: 'text' | 'template'
	content: {
		text?: { body: string }
		template?: {
			name: string
			language: { code: string }
			components?: Array<{
				type: 'body'
				parameters: Array<{
					type: 'text'
					parameter_name: string
					text: string
				}>
			}>
		}
		processedTemplate?: Template
	}
	timestamp: Date
	status: 'sent' | 'delivered' | 'read'
}

export interface StoredWebhookMessage {
	id: string
	from: string
	to: string
	phoneNumberId: string
	text: { body: string }
	timestamp: Date
	processed: boolean
}

export interface WebhookEvent {
	id: string
	timestamp: Date
	payload: unknown
	url: string
	status: 'pending' | 'delivered' | 'failed'
}

class MemoryStore {
	private messages: Map<string, StoredMessage> = new Map()
	private webhookMessages: Map<string, StoredWebhookMessage> = new Map()
	private webhookConfigs: Map<string, WebhookConfiguration> = new Map()
	private webhookEvents: Map<string, WebhookEvent> = new Map()
	private typingIndicators: Map<
		string,
		{ messageId: string; isTyping: boolean; timestamp: number }
	> = new Map()
	private messageIdCounter = 1

	// Generate realistic WhatsApp message ID
	generateMessageId(): string {
		const prefix = 'wamid.'
		const timestamp = Date.now().toString()
		const random = Math.random().toString(36).substring(2, 15)
		return `${prefix}${timestamp}_${random}_${this.messageIdCounter++}`
	}

	// Store outgoing message (sent via API)
	storeMessage(
		message: Omit<StoredMessage, 'id' | 'timestamp' | 'status'>
	): StoredMessage {
		const id = this.generateMessageId()
		const storedMessage: StoredMessage = {
			...message,
			id,
			timestamp: new Date(),
			status: 'sent',
		}

		this.messages.set(id, storedMessage)
		console.log(`📤 Stored outgoing message: ${id} to ${message.to}`)
		return storedMessage
	}

	// Store incoming webhook message
	storeWebhookMessage(params: SimulateMessageParams): StoredWebhookMessage {
		const stored: StoredWebhookMessage = {
			id: params.message.id,
			from: params.from,
			to: params.to,
			phoneNumberId: params.to, // In WhatsApp, 'to' is the bot's phone number ID
			text: params.message.text,
			timestamp: new Date(), // Always use server time for consistency
			processed: false,
		}

		this.webhookMessages.set(params.message.id, stored)
		console.log(
			`📥 Stored incoming webhook message: ${params.message.id} from ${params.from}`
		)
		return stored
	}

	// Get message by ID
	getMessage(id: string): StoredMessage | undefined {
		return this.messages.get(id)
	}

	// Get all messages
	getAllMessages(): StoredMessage[] {
		return Array.from(this.messages.values()).sort(
			(a, b) => a.timestamp.getTime() - b.timestamp.getTime()
		)
	}

	// Get all webhook messages
	getAllWebhookMessages(): StoredWebhookMessage[] {
		return Array.from(this.webhookMessages.values()).sort(
			(a, b) => a.timestamp.getTime() - b.timestamp.getTime()
		)
	}

	// Get all messages for a phone number
	getMessagesForPhoneNumber(phoneNumberId: string): StoredMessage[] {
		return Array.from(this.messages.values())
			.filter((msg) => msg.phoneNumberId === phoneNumberId)
			.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
	}

	// Clear all messages
	clearMessages(): void {
		this.messages.clear()
		console.log('🧹 Cleared all messages')
	}

	// Normalize phone number (remove/add + prefix consistently)
	private normalizePhoneNumber(phone: string): string {
		// Remove + if present, then add it back for consistency
		return phone.startsWith('+') ? phone : `+${phone}`
	}

	// Get conversation between two numbers
	getConversation(
		participantA: string,
		participantB: string
	): (StoredMessage | StoredWebhookMessage)[] {
		// Normalize phone numbers for consistent comparison
		const normalizedA = this.normalizePhoneNumber(participantA)
		const normalizedB = this.normalizePhoneNumber(participantB)

		// Get outgoing messages between the participants (both directions)
		const outgoing = Array.from(this.messages.values()).filter(
			(msg) =>
				(this.normalizePhoneNumber(msg.phoneNumberId) === normalizedA &&
					this.normalizePhoneNumber(msg.to) === normalizedB) ||
				(this.normalizePhoneNumber(msg.phoneNumberId) === normalizedB &&
					this.normalizePhoneNumber(msg.to) === normalizedA)
		)

		// Get incoming webhook messages between the participants (both directions)
		const incoming = Array.from(this.webhookMessages.values()).filter(
			(msg) =>
				(this.normalizePhoneNumber(msg.from) === normalizedA &&
					this.normalizePhoneNumber(msg.to) === normalizedB) ||
				(this.normalizePhoneNumber(msg.from) === normalizedB &&
					this.normalizePhoneNumber(msg.to) === normalizedA)
		)

		return [...outgoing, ...incoming].sort(
			(a, b) => a.timestamp.getTime() - b.timestamp.getTime()
		)
	}

	// Update message status
	updateMessageStatus(id: string, status: StoredMessage['status']): boolean {
		const message = this.messages.get(id)
		if (message) {
			message.status = status
			this.messages.set(id, message)
			console.log(`📊 Updated message ${id} status to ${status}`)
			return true
		}
		return false
	}

	// Webhook event management
	storeWebhookEvent(event: Omit<WebhookEvent, 'id'>): WebhookEvent {
		const id = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
		const storedEvent: WebhookEvent = {
			...event,
			id,
		}
		this.webhookEvents.set(id, storedEvent)
		return storedEvent
	}

	getAllWebhookEvents(): WebhookEvent[] {
		return Array.from(this.webhookEvents.values()).sort(
			(a, b) => a.timestamp.getTime() - b.timestamp.getTime()
		)
	}

	// Webhook configuration management
	setWebhookConfig(phoneNumberId: string, config: WebhookConfiguration): void {
		this.webhookConfigs.set(phoneNumberId, config)
		console.log(`🔗 Set webhook config for ${phoneNumberId}: ${config.url}`)
	}

	getWebhookConfig(phoneNumberId: string): WebhookConfiguration | undefined {
		return this.webhookConfigs.get(phoneNumberId)
	}

	getAllWebhookConfigs(): WebhookConfiguration[] {
		return Array.from(this.webhookConfigs.values())
	}

	// Mark webhook message as processed
	markWebhookMessageProcessed(id: string): boolean {
		const message = this.webhookMessages.get(id)
		if (message) {
			message.processed = true
			this.webhookMessages.set(id, message)
			return true
		}
		return false
	}

	// Typing indicator management
	setTypingIndicator(
		phoneNumberId: string,
		messageId: string,
		isTyping: boolean
	): void {
		const key = `${phoneNumberId}_${messageId}`
		this.typingIndicators.set(key, {
			messageId,
			isTyping,
			timestamp: Date.now(),
		})
		console.log(`⌨️ Set typing indicator for ${phoneNumberId}: ${isTyping}`)
	}

	getTypingIndicator(phoneNumberId: string, messageId: string): boolean {
		const key = `${phoneNumberId}_${messageId}`
		const indicator = this.typingIndicators.get(key)
		return indicator?.isTyping ?? false
	}

	getAllTypingIndicators(): Array<{
		phoneNumberId: string
		messageId: string
		isTyping: boolean
		timestamp: number
	}> {
		return Array.from(this.typingIndicators.entries()).map(([key, value]) => {
			const [phoneNumberId] = key.split('_')
			return {
				phoneNumberId,
				...value,
			}
		})
	}

	clearTypingIndicatorsForPhone(
		phoneNumberId: string
	): Array<{ messageId: string }> {
		const clearedIndicators: Array<{ messageId: string }> = []

		for (const [key, value] of this.typingIndicators.entries()) {
			if (key.startsWith(`${phoneNumberId}_`) && value.isTyping) {
				this.typingIndicators.set(key, { ...value, isTyping: false })
				clearedIndicators.push({ messageId: value.messageId })
			}
		}

		if (clearedIndicators.length > 0) {
			console.log(
				`⌨️ Cleared ${clearedIndicators.length} typing indicators for ${phoneNumberId}`
			)
		}

		return clearedIndicators
	}

	// Clear all data (useful for testing)
	clear(): void {
		this.messages.clear()
		this.webhookMessages.clear()
		this.webhookConfigs.clear()
		this.webhookEvents.clear()
		this.typingIndicators.clear()
		this.messageIdCounter = 1
		console.log('🧹 Cleared all mock data')
	}

	// Clear only webhook events
	clearWebhookEvents(): void {
		this.webhookEvents.clear()
		console.log('🧹 Cleared webhook events')
	}

	// Get stats
	getStats() {
		return {
			totalMessages: this.messages.size,
			totalWebhookMessages: this.webhookMessages.size,
			totalWebhookConfigs: this.webhookConfigs.size,
			totalWebhookEvents: this.webhookEvents.size,
			phoneNumbers: new Set([
				...Array.from(this.messages.values()).map((m) => m.phoneNumberId),
				...Array.from(this.webhookMessages.values()).map(
					(m) => m.phoneNumberId
				),
			]).size,
		}
	}
}

// Singleton instance
export const mockStore = new MemoryStore()

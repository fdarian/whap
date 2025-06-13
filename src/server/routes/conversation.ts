import { Hono } from 'hono'
import {
	type StoredMessage,
	type StoredWebhookMessage,
	mockStore,
} from '../store/memory-store.ts'

const conversationRouter = new Hono()

type CombinedMessage = StoredMessage | StoredWebhookMessage

// Normalize phone number (remove/add + prefix consistently)
function normalizePhoneNumber(phone: string): string {
	// Remove + if present, then add it back for consistency
	return phone.startsWith('+') ? phone : `+${phone}`
}

// GET /conversation - Get conversation history
conversationRouter.get('/', (c) => {
	const fromNumber = c.req.query('from')
	const toNumber = c.req.query('to')

	// Get both outgoing and incoming messages
	const outgoingMessages = mockStore.getAllMessages()
	const incomingMessages = mockStore.getAllWebhookMessages()
	let messages: CombinedMessage[] = [...outgoingMessages, ...incomingMessages]

	// Filter messages based on query parameters
	if (fromNumber && toNumber) {
		// Normalize phone numbers for comparison
		const normalizedFrom = normalizePhoneNumber(fromNumber)
		const normalizedTo = normalizePhoneNumber(toNumber)

		// Get conversation between specific participants
		messages = mockStore.getConversation(normalizedFrom, normalizedTo)
	} else if (fromNumber) {
		const normalizedFrom = normalizePhoneNumber(fromNumber)
		// Get all messages from a specific sender
		messages = messages.filter((msg) => {
			if ('content' in msg) {
				// StoredMessage
				return normalizePhoneNumber(msg.phoneNumberId) === normalizedFrom
			}
			// StoredWebhookMessage
			return normalizePhoneNumber(msg.from) === normalizedFrom
		})
	} else if (toNumber) {
		const normalizedTo = normalizePhoneNumber(toNumber)
		// Get all messages to a specific recipient
		messages = messages.filter((msg) => {
			if ('content' in msg) {
				// StoredMessage
				return (
					normalizePhoneNumber(msg.to) === normalizedTo ||
					normalizePhoneNumber(msg.phoneNumberId) === normalizedTo
				)
			}
			// StoredWebhookMessage
			return (
				normalizePhoneNumber(msg.to) === normalizedTo ||
				normalizePhoneNumber(msg.phoneNumberId) === normalizedTo
			)
		})
	}

	// Transform to conversation format
	const conversationMessages = messages.map((msg) => {
		if ('content' in msg) {
			// StoredMessage
			return {
				id: msg.id,
				to: msg.to,
				from: msg.phoneNumberId,
				text: msg.content.text?.body || msg.content.template?.name || '',
				timestamp: msg.timestamp,
				direction: 'sent' as const,
			}
		}
		// StoredWebhookMessage
		return {
			id: msg.id,
			to: msg.to,
			from: msg.from,
			text: msg.text.body || '',
			timestamp: msg.timestamp,
			direction: 'received' as const,
		}
	})

	const participants = Array.from(
		new Set([
			...messages.map((m) => m.to),
			...messages.map((m) => {
				if ('content' in m) {
					return m.phoneNumberId
				}
				return m.from
			}),
		])
	).filter(Boolean)

	return c.json({
		messages: conversationMessages,
		participants,
	})
})

// DELETE /conversation - Clear conversation history
conversationRouter.delete('/', (c) => {
	mockStore.clearMessages()
	return c.json({ success: true, message: 'Conversation history cleared' })
})

export { conversationRouter }

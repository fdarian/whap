import type { ServerWebSocket } from 'bun'

const clients = new Set<ServerWebSocket<unknown>>()

export const addClient = (ws: ServerWebSocket<unknown>) => {
	clients.add(ws)
}

export const removeClient = (ws: ServerWebSocket<unknown>) => {
	clients.delete(ws)
}

interface BroadcastMessage {
	type: 'NEW_MESSAGE' | 'STATS_UPDATE' | 'TYPING_INDICATOR'
	payload: unknown
}

export const broadcast = (message: BroadcastMessage) => {
	const serializedMessage = JSON.stringify(message)
	for (const client of clients) {
		if (client.readyState === WebSocket.OPEN) {
			try {
				client.send(serializedMessage)
			} catch (error) {
				console.warn('Failed to send message to WebSocket client:', error)
				// Optionally remove the client if send fails consistently
				clients.delete(client)
			}
		}
	}
}

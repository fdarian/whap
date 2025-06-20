import ReconnectingWebSocket from 'reconnecting-websocket'

type MessageType = 'NEW_MESSAGE' | 'STATS_UPDATE' | 'TYPING_INDICATOR'

interface WebSocketMessage {
	type: MessageType
	payload: unknown
}

type MessageListener = (message: WebSocketMessage) => void
type ConnectionStatusListener = (isConnected: boolean) => void

class WebSocketClient {
	private ws: ReconnectingWebSocket | null = null
	private messageListeners: Set<MessageListener> = new Set()
	private connectionStatusListeners: Set<ConnectionStatusListener> = new Set()
	public isConnected = false

	connect() {
		if (this.ws) {
			return
		}

		const port = process.env.PORT || 3010
		const wsUrl = `ws://localhost:${port}/ws`

		this.ws = new ReconnectingWebSocket(wsUrl, [], {
			minReconnectionDelay: 1000,
			maxReconnectionDelay: 10000,
			reconnectionDelayGrowFactor: 1.3,
			connectionTimeout: 4000,
			maxRetries: Number.POSITIVE_INFINITY,
			debug: false,
		})

		this.ws.onopen = () => {
			console.log('WebSocket connected')
			this.isConnected = true
			for (const listener of this.connectionStatusListeners) {
				listener(true)
			}
		}

		this.ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data) as WebSocketMessage
				for (const listener of this.messageListeners) {
					listener(message)
				}
			} catch (error) {
				console.error('Error parsing WebSocket message:', error)
			}
		}

		this.ws.onclose = () => {
			console.log('WebSocket disconnected')
			this.isConnected = false
			for (const listener of this.connectionStatusListeners) {
				listener(false)
			}
		}

		this.ws.onerror = (error) => {
			console.error('WebSocket error:', error)
		}
	}

	disconnect() {
		if (this.ws) {
			this.ws.close()
			this.ws = null
			this.isConnected = false
		}
		// Optionally clear listeners
		// this.messageListeners.clear()
		// this.connectionStatusListeners.clear()
	}

	addMessageListener(listener: MessageListener) {
		this.messageListeners.add(listener)
	}

	removeMessageListener(listener: MessageListener) {
		this.messageListeners.delete(listener)
	}

	addConnectionStatusListener(listener: ConnectionStatusListener) {
		this.connectionStatusListeners.add(listener)
	}

	removeConnectionStatusListener(listener: ConnectionStatusListener) {
		this.connectionStatusListeners.delete(listener)
	}
}

export const webSocketClient = new WebSocketClient()

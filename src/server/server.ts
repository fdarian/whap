import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createBunWebSocket } from 'hono/bun'
import type { ServerWebSocket } from 'bun'
import { conversationRouter } from './routes/conversation.ts'
import { messagesRouter } from './routes/messages.ts'
import { statusRouter } from './routes/status.ts'
import { webhooksRouter } from './routes/webhooks.ts'
import { addClient, removeClient } from './websocket.ts'

const app = new Hono()
const PORT = Number(process.env.PORT) || 3010

const { upgradeWebSocket, websocket } = createBunWebSocket()

// Middleware
app.use('*', cors())
app.use('*', logger())

// Custom logging middleware for request bodies
app.use('*', async (c, next) => {
	const method = c.req.method
	const path = c.req.path
	console.log(`[${new Date().toISOString()}] ${method} ${path}`)

	// Log headers
	const headerEntries = Object.entries(c.req.header())
	console.log('Headers:', Object.fromEntries(headerEntries))

	// Log body for POST/PUT requests
	if (method === 'POST' || method === 'PUT') {
		try {
			const body = await c.req.json()
			console.log('Body:', JSON.stringify(body, null, 2))
		} catch {
			// Body might not be JSON, that's okay
		}
	}

	await next()
})

// Routes
app.get('/health', (c) => c.json({ ok: true, message: 'Server is healthy' }))
app.route('/v22.0', messagesRouter)
// The /mock path is for internal simulation tools
app.route('/mock', webhooksRouter)
app.route('/status', statusRouter)
app.route('/conversation', conversationRouter)
// The webhook endpoint for WhatsApp is the root of the webhooksRouter
app.route('/webhook', webhooksRouter)

// WebSocket route using Hono's upgradeWebSocket
app.get(
	'/ws',
	upgradeWebSocket((c) => {
		return {
			onOpen: (_event, ws) => {
				console.log('WebSocket connection opened')
				addClient(ws.raw as ServerWebSocket<unknown>)
			},
			onMessage: (event, ws) => {
				console.log('WebSocket message received:', event.data)
				// Handle incoming websocket messages if needed
			},
			onClose: (_event, ws) => {
				console.log('WebSocket connection closed')
				removeClient(ws.raw as ServerWebSocket<unknown>)
			},
		}
	})
)

// 404 handler
app.notFound((c) => {
	return c.json(
		{
			error: {
				message: `WhatsApp Mock Server: Route ${c.req.method} ${c.req.path} not found`,
				type: 'not_found',
				code: 404,
			},
		},
		404
	)
})

// Error handler
app.onError((err, c) => {
	console.error('Error:', err)
	return c.json(
		{
			error: {
				message: 'Internal server error',
				type: 'server_error',
				code: 500,
			},
		},
		500
	)
})

const server = Bun.serve({
	port: PORT,
	fetch: app.fetch,
	websocket,
})

console.log(`🚀 Server is running on port ${PORT}`)
console.log(`Websocket server is running on ws://localhost:${PORT}/ws`)

export default server

// This allows the server to be run directly for development
if (
	import.meta.url.startsWith('file://') &&
	process.argv[1] === new URL(import.meta.url).pathname
) {
	console.log('Running server directly...')
}

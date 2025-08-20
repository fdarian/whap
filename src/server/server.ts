import 'dotenv/config'
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { getWebhookConfig } from './config.ts'
import { conversationRouter } from './routes/conversation.ts'
import { messagesRouter } from './routes/messages.ts'
import { statusRouter } from './routes/status.ts'
import { templatesRouter } from './routes/templates.ts'
import { webhooksRouter } from './routes/webhooks.ts'
import { templateStore } from './store/template-store.ts'
import { addClient, removeClient } from './websocket.ts'

const app = new Hono()
const PORT = Number(process.env.PORT) || 3010

// Initialize webhook configuration from CLI arguments and environment
getWebhookConfig()

// Initialize template store with hot-reload
templateStore.initialize().catch((error) => {
	console.error('❌ Failed to initialize template store:', error)
})

const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({
	app,
})

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
			const clone = c.req.raw.clone()
			const bodyText = await clone.text()
			console.log('Body:', bodyText)
		} catch {
			// Body might not be readable, that's okay
		}
	}

	await next()
})

// Routes
app.get('/health', (c) =>
	c.json({
		ok: true,
		message: 'Server is healthy',
		templates: templateStore.getStats(),
	})
)

// Debug endpoints (only in development)
if (process.env.NODE_ENV !== 'production') {
	// Debug endpoint for templates
	app.get('/debug/templates', (c) =>
		c.json({
			stats: templateStore.getStats(),
			templates: templateStore.getAllTemplates(),
			templateNames: templateStore.getTemplateNames(),
		})
	)

	// Manual refresh endpoint for testing
	app.post('/debug/reload-templates', async (c) => {
		try {
			await templateStore.reloadTemplates()
			return c.json({
				success: true,
				message: 'Templates reloaded successfully',
				stats: templateStore.getStats(),
			})
		} catch (error) {
			return c.json(
				{
					success: false,
					message: 'Failed to reload templates',
					error: error instanceof Error ? error.message : 'Unknown error',
				},
				500
			)
		}
	})
}
app.route('/v22.0', messagesRouter)
app.route('/v22.0', templatesRouter)
// The /mock path is for internal simulation tools
app.route('/mock', webhooksRouter)
app.route('/status', statusRouter)
app.route('/conversation', conversationRouter)
// The webhook endpoint for WhatsApp is the root of the webhooksRouter
app.route('/webhook', webhooksRouter)

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

app.get(
	'/ws',
	upgradeWebSocket((c) => {
		return {
			onOpen: (_evt, ws) => {
				console.log('WebSocket connection opened')
				// biome-ignore lint/suspicious/noExplicitAny: agent wrote this
				addClient(ws as any)
			},
			onClose: (_evt, ws) => {
				console.log('WebSocket connection closed')
				// biome-ignore lint/suspicious/noExplicitAny: agent wrote this
				removeClient(ws as any)
			},
			onError: (err, ws) => {
				console.error('WebSocket error:', err)
				// biome-ignore lint/suspicious/noExplicitAny: agent wrote this
				removeClient(ws as any)
			},
		}
	})
)

const server = serve({
	fetch: app.fetch,
	port: PORT,
})

injectWebSocket(server)

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

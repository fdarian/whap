import 'dotenv/config'
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { getWebhookConfig } from './config.ts'
import { getTemplatesConfig } from './configuration.ts'
import { conversationRouter } from './routes/conversation.ts'
import { createMessagesRouter } from './routes/messages.ts'
import { phoneRouter } from './routes/phone.ts'
import { startStatsInterval, statusRouter } from './routes/status.ts'
import { createTemplatesRouter } from './routes/templates.ts'
import { webhooksRouter } from './routes/webhooks.ts'
import { TemplateStore } from './store/template-store.ts'
import { TemplateResolver } from './template-resolver.ts'
import { addClient, removeClient } from './websocket.ts'

function createApp(templateStore: TemplateStore) {
	const app = new Hono()

	// Initialize webhook configuration from CLI arguments and environment
	getWebhookConfig()

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

	// Create routers with the store instance
	const messagesRouter = createMessagesRouter(templateStore)
	const templatesRouter = createTemplatesRouter(templateStore)

	app.route('/v22.0', messagesRouter)
	app.route('/v22.0', templatesRouter)
	app.route('/v22.0', phoneRouter)
	// Assuming 22 and 23 are the same
	app.route('/v23.0', messagesRouter)
	app.route('/v23.0', templatesRouter)
	app.route('/v23.0', phoneRouter)
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

	return { app, injectWebSocket }
}

export async function startServer(port = 3010) {
	// Load templates configuration and create template store
	const templatesConfig = getTemplatesConfig()
	let templateResolver: TemplateResolver | undefined
	if (templatesConfig?.cmd) {
		templateResolver = new TemplateResolver(templatesConfig.cmd)
	}

	// Create template store with optional resolver
	const store = new TemplateStore('./templates', templateResolver)
	await store.initialize().catch((error) => {
		console.error('❌ Failed to initialize template store:', error)
		throw error
	})

	const { app, injectWebSocket } = createApp(store)

	const server = serve({
		fetch: app.fetch,
		port: port,
	})

	injectWebSocket(server)

	// Start the stats broadcasting interval
	startStatsInterval()

	console.log(`🚀 Server is running on port ${port}`)
	console.log(`Websocket server is running on ws://localhost:${port}/ws`)

	return server
}

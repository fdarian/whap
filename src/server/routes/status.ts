import { Hono } from 'hono'
import { mockStore } from '../store/memory-store.ts'
import { broadcast } from '../websocket.ts'

const statusRouter = new Hono()

const serverStartTime = Date.now()

// Shared function to calculate server statistics
function calculateStats() {
	const uptime = Date.now() - serverStartTime
	const messages = mockStore.getAllMessages()
	const webhookEvents = mockStore.getAllWebhookEvents()

	// Find the most recent activity
	const lastMessageTime =
		messages.length > 0
			? Math.max(...messages.map((m) => m.timestamp.getTime()))
			: null
	const lastWebhookTime =
		webhookEvents.length > 0
			? Math.max(...webhookEvents.map((w) => w.timestamp.getTime()))
			: null

	const lastActivity =
		lastMessageTime && lastWebhookTime
			? new Date(Math.max(lastMessageTime, lastWebhookTime))
			: lastMessageTime
				? new Date(lastMessageTime)
				: lastWebhookTime
					? new Date(lastWebhookTime)
					: null

	return {
		totalMessages: messages.length,
		totalWebhooks: webhookEvents.length,
		uptime: Math.floor(uptime / 1000), // in seconds
		lastActivity: lastActivity?.toISOString() || null,
	}
}

// Store the interval ID for cleanup
const statsIntervalId: NodeJS.Timeout = setInterval(() => {
	const stats = calculateStats()
	broadcast({
		type: 'STATS_UPDATE',
		payload: {
			totalMessages: stats.totalMessages,
			uptime: stats.uptime,
			lastActivity: stats.lastActivity,
		},
	})
}, 10000) // Broadcast every 10 seconds

// Cleanup function to clear the interval
function cleanupStatsInterval() {
	if (statsIntervalId) {
		clearInterval(statsIntervalId)
	}
}

// GET /status - Get server status
// GET /status - Get server status
statusRouter.get('/status', (c) => {
	try {
		const uptime = Date.now() - serverStartTime
		const messages = mockStore.getAllMessages()
		const webhookEvents = mockStore.getAllWebhookEvents()

		return c.json({
			connected: true,
			uptime: Math.floor(uptime / 1000), // in seconds
			messageCount: messages.length,
			webhookCount: webhookEvents.length,
		})
	} catch (error) {
		console.error('Error getting server status:', error)
		return c.json({ error: 'Failed to get server status' }, 500)
	}
})

// GET /stats - Get detailed statistics
statusRouter.get('/stats', (c) => {
	try {
		const stats = calculateStats()
		return c.json(stats)
	} catch (error) {
		return c.json(
			{
				error: {
					message: 'Failed to calculate statistics',
					type: 'stats_error',
					code: 500,
				},
			},
			500
		)
	}
})

export { statusRouter, cleanupStatsInterval }

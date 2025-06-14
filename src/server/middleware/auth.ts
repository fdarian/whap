import type { MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import { getAllowedTokens, getRateLimitConfig } from '../config.ts'
import type { WhatsAppErrorResponse } from '../types/api-types.ts'

const requestCounts = new Map<
	string,
	{ count: number; timer: NodeJS.Timeout }
>()

const rateLimiterInternal = createMiddleware(async (c, next) => {
	// Get rate limit config dynamically to support test environments
	const { windowMs, maxRequests } = getRateLimitConfig()

	// Get IP with fallback for test environments
	const ip =
		c.req.header('x-forwarded-for') ||
		c.req.header('host') ||
		c.req.header('x-real-ip') ||
		'127.0.0.1'

	// Get the token from context (set by the bearer auth middleware)
	const token = c.get('token') || 'anonymous'
	const key = `${ip}:${token}`

	let record = requestCounts.get(key)
	if (!record) {
		const newRecord = {
			count: 0,
			timer: setTimeout(() => {
				requestCounts.delete(key)
			}, windowMs),
		}
		requestCounts.set(key, newRecord)
		record = newRecord
	}

	record.count++

	if (record.count > maxRequests) {
		const errorResponse: WhatsAppErrorResponse = {
			error: {
				message: 'Too many requests, please try again later.',
				type: 'RATE_LIMIT',
				code: 13,
				error_data: {
					messaging_product: 'whatsapp',
					details: `Rate limit exceeded. Max requests: ${maxRequests} per ${
						windowMs / 1000
					} seconds.`,
				},
			},
		}
		return c.json(errorResponse, 429)
	}

	await next()
})
;(rateLimiterInternal as MiddlewareHandler & { reset?: () => void }).reset =
	() => {
		requestCounts.clear()
	}

export const rateLimiter = rateLimiterInternal as MiddlewareHandler & {
	reset: () => void
}

// Custom bearer auth middleware that returns proper JSON responses
const customBearerAuth = createMiddleware(async (c, next) => {
	const authHeader = c.req.header('authorization')

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		const errorResponse: WhatsAppErrorResponse = {
			error: {
				message: 'Authentication token is missing or invalid',
				type: 'OAuthException',
				code: 190,
				fbtrace_id: 'some-trace-id',
			},
		}
		return c.json(errorResponse, 401)
	}

	const token = authHeader.replace('Bearer ', '')
	const tokens = getAllowedTokens()

	if (!tokens.includes(token)) {
		const errorResponse: WhatsAppErrorResponse = {
			error: {
				message: 'Authentication token is missing or invalid',
				type: 'OAuthException',
				code: 190,
				fbtrace_id: 'some-trace-id',
			},
		}
		return c.json(errorResponse, 401)
	}

	// Store the token in context for use by other middleware
	c.set('token', token)
	await next()
})

export const createAuthMiddleware = (): MiddlewareHandler[] => {
	return [customBearerAuth, rateLimiter]
}

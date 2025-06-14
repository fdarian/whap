import { Hono } from 'hono'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware, rateLimiter } from './auth.ts'

describe('Auth Middleware', () => {
	let app: Hono
	const TOKEN = 'test-token'

	beforeAll(() => {
		// Set environment variables BEFORE creating middleware
		process.env.MOCK_API_TOKENS = TOKEN
		process.env.RATE_LIMIT_MAX_REQUESTS = '5'

		app = new Hono()
		app.use('/test', ...createAuthMiddleware())
		app.get('/test', (c) => c.text('OK'))
	})

	afterAll(() => {
		process.env.MOCK_API_TOKENS = undefined
		process.env.RATE_LIMIT_MAX_REQUESTS = undefined
	})

	beforeEach(() => {
		rateLimiter.reset()
	})

	it('should return 401 if no auth header is provided', async () => {
		const res = await app.request('/test')
		expect(res.status).toBe(401)
		const json = await res.json()
		expect(json.error.message).toBe(
			'Authentication token is missing or invalid'
		)
		expect(json.error.type).toBe('OAuthException')
	})

	it('should return 401 if token is invalid', async () => {
		const res = await app.request('/test', {
			headers: {
				Authorization: 'Bearer invalid-token',
			},
		})
		expect(res.status).toBe(401)
		const json = await res.json()
		expect(json.error.message).toBe(
			'Authentication token is missing or invalid'
		)
		expect(json.error.type).toBe('OAuthException')
	})

	it('should allow access with a valid token', async () => {
		const res = await app.request('/test', {
			headers: {
				Authorization: `Bearer ${TOKEN}`,
			},
		})
		expect(res.status).toBe(200)
		expect(await res.text()).toBe('OK')
	})

	it('should return 429 if rate limit is exceeded', async () => {
		// Make 5 successful requests (within limit)
		for (let i = 0; i < 5; i++) {
			const res = await app.request('/test', {
				headers: {
					Authorization: `Bearer ${TOKEN}`,
				},
			})
			expect(res.status).toBe(200)
		}

		// 6th request should be rate limited
		const res = await app.request('/test', {
			headers: {
				Authorization: `Bearer ${TOKEN}`,
			},
		})
		expect(res.status).toBe(429)
		const json = await res.json()
		expect(json.error.message).toBe(
			'Too many requests, please try again later.'
		)
		expect(json.error.type).toBe('RATE_LIMIT')
	})
})

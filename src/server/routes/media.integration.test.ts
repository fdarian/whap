import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { testClient } from 'hono/testing'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mockStore } from '../store/memory-store.ts'
import type { MediaFile } from '../store/memory-store.ts'
import type { WhatsAppErrorResponse } from '../types/api-types.ts'
import { mediaRouter } from './media.ts'

describe('Media API Integration Tests', () => {
	const client = testClient(mediaRouter)
	let testMediaFile: MediaFile

	beforeEach(() => {
		// Set test API token
		process.env.MOCK_API_TOKENS = 'test-token-123'

		// Clear store
		mockStore.clear()

		// Create test media directory
		if (!existsSync('.whap/media')) {
			mkdirSync('.whap/media', { recursive: true })
		}

		// Create test file
		const testContent = Buffer.from(
			'test-image-content-for-integration-testing'
		)
		writeFileSync('.whap/media/test-image.jpg', testContent)

		// Store media file
		testMediaFile = mockStore.storeMediaFile({
			filename: 'test-image.jpg',
			filePath: '.whap/media/test-image.jpg',
			mimeType: 'image/jpeg',
			fileSize: testContent.length,
			phoneNumberId: '1234567890',
			status: 'uploaded',
			metadata: {
				originalName: 'test-image.jpg',
				width: 800,
				height: 600,
			},
		})
	})

	afterEach(() => {
		// Clean up
		if (existsSync('.whap/media/test-image.jpg')) {
			rmSync('.whap/media/test-image.jpg')
		}
		mockStore.clear()
		process.env.MOCK_API_TOKENS = undefined
	})

	describe('Authentication Error Handling', () => {
		test('should return 401 for missing authorization header', async () => {
			const res = await client[`/${testMediaFile.id}`].$get()
			expect(res.status).toBe(401)

			const errorResponse = (await res.json()) as WhatsAppErrorResponse
			expect(errorResponse.error.message).toBe(
				'Authentication token is missing or invalid'
			)
			expect(errorResponse.error.type).toBe('OAuthException')
			expect(errorResponse.error.code).toBe(190)
		})

		test('should return 401 for invalid bearer token', async () => {
			const res = await client[`/${testMediaFile.id}`].$get(
				{},
				{
					headers: { Authorization: 'Bearer invalid-token' },
				}
			)
			expect(res.status).toBe(401)

			const errorResponse = (await res.json()) as WhatsAppErrorResponse
			expect(errorResponse.error.message).toBe(
				'Authentication token is missing or invalid'
			)
			expect(errorResponse.error.type).toBe('OAuthException')
			expect(errorResponse.error.code).toBe(190)
		})

		test('should return 401 for malformed authorization header', async () => {
			const res = await client[`/${testMediaFile.id}`].$get(
				{},
				{
					headers: { Authorization: 'NotBearer token' },
				}
			)
			expect(res.status).toBe(401)

			const errorResponse = (await res.json()) as WhatsAppErrorResponse
			expect(errorResponse.error.message).toBe(
				'Authentication token is missing or invalid'
			)
			expect(errorResponse.error.type).toBe('OAuthException')
			expect(errorResponse.error.code).toBe(190)
		})
	})

	describe('Media ID Validation Error Handling', () => {
		test('should return 400 for invalid media ID pattern', async () => {
			const res = await client['/invalid-media-id'].$get(
				{},
				{
					headers: { Authorization: 'Bearer test-token-123' },
				}
			)
			expect(res.status).toBe(400)

			const errorResponse = (await res.json()) as WhatsAppErrorResponse
			expect(errorResponse.error.message).toBe('Invalid media ID format')
			expect(errorResponse.error.type).toBe('validation_error')
			expect(errorResponse.error.code).toBe(400)
		})

		test('should return 400 for media ID not starting with media_', async () => {
			const res = await client['/notmedia_123_abc'].$get(
				{},
				{
					headers: { Authorization: 'Bearer test-token-123' },
				}
			)
			expect(res.status).toBe(400)

			const errorResponse = (await res.json()) as WhatsAppErrorResponse
			expect(errorResponse.error.message).toBe('Invalid media ID format')
			expect(errorResponse.error.type).toBe('validation_error')
			expect(errorResponse.error.code).toBe(400)
		})
	})

	describe('Media Not Found Error Handling', () => {
		test('should return 404 for non-existent media ID', async () => {
			const res = await client['/media_999_nonexistent'].$get(
				{},
				{
					headers: { Authorization: 'Bearer test-token-123' },
				}
			)
			expect(res.status).toBe(404)

			const errorResponse = (await res.json()) as WhatsAppErrorResponse
			expect(errorResponse.error.message).toBe('Media not found')
			expect(errorResponse.error.type).toBe('not_found')
			expect(errorResponse.error.code).toBe(404)
		})
	})

	describe('Media Processing Error Handling', () => {
		test('should return 410 for failed media processing', async () => {
			// Update media status to failed
			mockStore.updateMediaFileStatus(testMediaFile.id, 'failed')

			const res = await client[`/${testMediaFile.id}`].$get(
				{},
				{
					headers: { Authorization: 'Bearer test-token-123' },
				}
			)
			expect(res.status).toBe(410)

			const errorResponse = (await res.json()) as WhatsAppErrorResponse
			expect(errorResponse.error.message).toBe('Media file processing failed')
			expect(errorResponse.error.type).toBe('media_error')
			expect(errorResponse.error.code).toBe(410)
		})
	})

	describe('File System Error Handling', () => {
		test('should return 404 when media file is missing from disk', async () => {
			// Remove the actual file but keep metadata
			rmSync('.whap/media/test-image.jpg')

			const res = await client[`/${testMediaFile.id}/download`].$get(
				{},
				{
					headers: { Authorization: 'Bearer test-token-123' },
				}
			)
			expect(res.status).toBe(404)

			const errorResponse = (await res.json()) as WhatsAppErrorResponse
			expect(errorResponse.error.message).toBe('Media file not found on disk')
			expect(errorResponse.error.type).toBe('file_not_found')
			expect(errorResponse.error.code).toBe(404)
		})

		test('should return 403 for path traversal attempt', async () => {
			// Create a malicious media file entry
			const maliciousMediaFile = mockStore.storeMediaFile({
				filename: 'evil.txt',
				filePath: '../../../etc/passwd',
				mimeType: 'text/plain',
				fileSize: 100,
				phoneNumberId: '1234567890',
				status: 'uploaded',
			})

			const res = await client[`/${maliciousMediaFile.id}/download`].$get(
				{},
				{
					headers: { Authorization: 'Bearer test-token-123' },
				}
			)
			expect(res.status).toBe(403)

			const errorResponse = (await res.json()) as WhatsAppErrorResponse
			expect(errorResponse.error.message).toBe('Unauthorized file access')
			expect(errorResponse.error.type).toBe('security_error')
			expect(errorResponse.error.code).toBe(403)
		})
	})

	describe('Successful Media Retrieval', () => {
		test('should successfully retrieve media metadata', async () => {
			const res = await client[`/${testMediaFile.id}`].$get(
				{},
				{
					headers: { Authorization: 'Bearer test-token-123' },
				}
			)
			expect(res.status).toBe(200)

			const mediaResponse = await res.json()
			expect(mediaResponse.id).toBe(testMediaFile.id)
			expect(mediaResponse.mime_type).toBe('image/jpeg')
			expect(mediaResponse.file_size).toBeGreaterThan(0)
			expect(mediaResponse.sha256).toBeDefined()
			expect(mediaResponse.url).toContain('/download')
		})

		test('should successfully download media file', async () => {
			const res = await client[`/${testMediaFile.id}/download`].$get(
				{},
				{
					headers: { Authorization: 'Bearer test-token-123' },
				}
			)
			expect(res.status).toBe(200)
			expect(res.headers.get('content-type')).toBe('image/jpeg')
			expect(res.headers.get('content-disposition')).toContain('test-image.jpg')

			const content = await res.arrayBuffer()
			expect(content.byteLength).toBeGreaterThan(0)
		})
	})
})

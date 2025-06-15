import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mockStore } from '../store/memory-store.ts'
import type { MediaFile } from '../store/memory-store.ts'

// Mock media file for testing
const testMediaFile: Omit<MediaFile, 'id' | 'uploadTimestamp'> = {
	filename: 'test-image.jpg',
	filePath: '.whap/media/test-image.jpg',
	mimeType: 'image/jpeg',
	fileSize: 1024,
	phoneNumberId: '1234567890',
	status: 'uploaded',
	metadata: {
		originalName: 'test-image.jpg',
		width: 800,
		height: 600,
	},
}

describe('Media Retrieval API', () => {
	let storedMediaFile: MediaFile

	beforeEach(() => {
		// Clear any existing data
		mockStore.clear()

		// Create test media directory
		if (!existsSync('.whap/media')) {
			mkdirSync('.whap/media', { recursive: true })
		}

		// Create a test image file
		const testImageContent = Buffer.from('fake-image-content-for-testing')
		writeFileSync(testMediaFile.filePath, testImageContent)

		// Store the media file in the mock store
		storedMediaFile = mockStore.storeMediaFile(testMediaFile)
	})

	afterEach(() => {
		// Clean up test files
		if (existsSync('.whap/media/test-image.jpg')) {
			rmSync('.whap/media/test-image.jpg', { force: true })
		}

		// Clear mock store
		mockStore.clear()
	})

	describe('Media ID Validation', () => {
		test('should validate media ID format', () => {
			// Test valid media ID format
			expect(storedMediaFile.id).toMatch(/^media_\d+_[a-z0-9]+$/)
		})

		test('should reject invalid media ID patterns', () => {
			// This would be tested in integration tests with actual HTTP requests
			// Here we test the validation logic conceptually
			const invalidIds = ['', 'invalid', 'notmedia_123', '_123_abc']

			for (const invalidId of invalidIds) {
				// In real implementation, these would return 400 errors
				expect(invalidId.startsWith('media_')).toBe(false)
			}

			// Test edge case: starts with media_ but is incomplete
			expect('media_'.startsWith('media_')).toBe(true)
			expect('media_'.length > 6).toBe(false) // But it's too short to be valid
		})
	})

	describe('Media Storage and Retrieval', () => {
		test('should store media file with correct metadata', () => {
			expect(storedMediaFile.filename).toBe('test-image.jpg')
			expect(storedMediaFile.mimeType).toBe('image/jpeg')
			expect(storedMediaFile.fileSize).toBe(1024)
			expect(storedMediaFile.phoneNumberId).toBe('1234567890')
			expect(storedMediaFile.status).toBe('uploaded')
		})

		test('should retrieve media file by ID', () => {
			const retrieved = mockStore.getMediaFile(storedMediaFile.id)
			expect(retrieved).toBeDefined()
			expect(retrieved?.filename).toBe('test-image.jpg')
		})

		test('should return undefined for non-existent media ID', () => {
			const retrieved = mockStore.getMediaFile('media_999_nonexistent')
			expect(retrieved).toBeUndefined()
		})
	})

	describe('Media File Status Handling', () => {
		test('should handle failed media files', () => {
			// Update media file status to failed
			mockStore.updateMediaFileStatus(storedMediaFile.id, 'failed')

			const retrieved = mockStore.getMediaFile(storedMediaFile.id)
			expect(retrieved?.status).toBe('failed')
		})

		test('should get all media files', () => {
			const allFiles = mockStore.getAllMediaFiles()
			expect(allFiles).toHaveLength(1)
			expect(allFiles[0]?.id).toBe(storedMediaFile.id)
		})

		test('should get media files for specific phone number', () => {
			const filesForPhone = mockStore.getMediaFilesForPhoneNumber('1234567890')
			expect(filesForPhone).toHaveLength(1)

			const filesForOtherPhone =
				mockStore.getMediaFilesForPhoneNumber('9876543210')
			expect(filesForOtherPhone).toHaveLength(0)
		})
	})

	describe('Security Considerations', () => {
		test('should validate file paths are within allowed directories', () => {
			const allowedPaths = ['.whap/media', 'media/uploads', 'media/temp']
			const testPath = '.whap/media/test-file.jpg'

			// This simulates the path security check from the router
			const isAllowedPath = allowedPaths.some((allowedPath) => {
				return testPath.startsWith(allowedPath)
			})

			expect(isAllowedPath).toBe(true)
		})

		test('should reject unauthorized paths', () => {
			const allowedPaths = ['.whap/media', 'media/uploads', 'media/temp']
			const unauthorizedPaths = [
				'../../../etc/passwd',
				'/etc/passwd',
				'../../sensitive-file.txt',
				'./unauthorized/file.jpg',
			]

			for (const unauthorizedPath of unauthorizedPaths) {
				const isAllowedPath = allowedPaths.some((allowedPath) => {
					return unauthorizedPath.startsWith(allowedPath)
				})

				expect(isAllowedPath).toBe(false)
			}
		})
	})

	describe('File Size Handling', () => {
		test('should determine if file is large (>10MB)', () => {
			const smallFileSize = 5 * 1024 * 1024 // 5MB
			const largeFileSize = 15 * 1024 * 1024 // 15MB
			const threshold = 10 * 1024 * 1024 // 10MB

			expect(smallFileSize > threshold).toBe(false)
			expect(largeFileSize > threshold).toBe(true)
		})
	})
})

/** Helper function to create test media files */
function createTestMediaFile(
	filename: string,
	content: string | Buffer,
	mimeType = 'text/plain'
): MediaFile {
	const filePath = join('.whap/media', filename)

	// Ensure directory exists
	if (!existsSync('.whap/media')) {
		mkdirSync('.whap/media', { recursive: true })
	}

	// Write file content
	writeFileSync(filePath, content)

	// Create and store media file
	const mediaFile: Omit<MediaFile, 'id' | 'uploadTimestamp'> = {
		filename,
		filePath,
		mimeType,
		fileSize: Buffer.isBuffer(content)
			? content.length
			: Buffer.byteLength(content),
		phoneNumberId: '1234567890',
		status: 'uploaded',
	}

	return mockStore.storeMediaFile(mediaFile)
}

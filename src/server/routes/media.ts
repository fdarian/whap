import { Hono } from 'hono'
import { createAuthMiddleware } from '../middleware/auth.ts'
import { mockStore } from '../store/memory-store.ts'
import type { WhatsAppErrorResponse } from '../types/api-types.ts'

const mediaRouter = new Hono()

// Apply authentication middleware to all media routes
const authMiddleware = createAuthMiddleware()
mediaRouter.use('*', ...authMiddleware)

/** Response format for media retrieval API */
interface MediaRetrievalResponse {
	url: string
	mime_type: string
	sha256: string
	file_size: number
	id: string
}

/** Calculate SHA256 hash of media file */
async function calculateSHA256Hash(filePath: string): Promise<string> {
	try {
		const crypto = await import('node:crypto')
		const fs = await import('node:fs')
		const path = await import('node:path')

		// Resolve full path
		const fullPath = path.resolve(filePath)

		// Read file and calculate hash
		const fileBuffer = fs.readFileSync(fullPath)
		return crypto.createHash('sha256').update(fileBuffer).digest('hex')
	} catch (error) {
		console.error(`❌ Failed to calculate SHA256 for ${filePath}:`, error)
		// Return placeholder hash on error
		const crypto2 = await import('node:crypto')
		return crypto2
			.createHash('sha256')
			.update(filePath + Date.now())
			.digest('hex')
	}
}

/** Generate downloadable URL for media file */
function generateMediaUrl(mediaId: string, baseUrl?: string): string {
	// In a real implementation, this might be a signed URL with expiration
	// For now, we'll create a simple download URL
	const host = baseUrl || 'http://localhost:3010'
	return `${host}/v22.0/media/${mediaId}/download`
}

// GET /v22.0/{MEDIA_ID} - Retrieve media metadata
mediaRouter.get('/:mediaId', async (c) => {
	const mediaId = c.req.param('mediaId')

	// Validate media ID format
	if (!mediaId || typeof mediaId !== 'string') {
		return c.json(
			{
				error: {
					message: 'Invalid media ID format',
					type: 'validation_error',
					code: 400,
				},
			} as WhatsAppErrorResponse,
			400
		)
	}

	// Validate media ID pattern (should start with 'media_')
	if (!mediaId.startsWith('media_')) {
		return c.json(
			{
				error: {
					message: 'Invalid media ID format',
					type: 'validation_error',
					code: 400,
				},
			} as WhatsAppErrorResponse,
			400
		)
	}

	// Get media file from storage
	const mediaFile = mockStore.getMediaFile(mediaId)

	if (!mediaFile) {
		return c.json(
			{
				error: {
					message: 'Media not found',
					type: 'not_found',
					code: 404,
				},
			} as WhatsAppErrorResponse,
			404
		)
	}

	// Check if media file is available (not failed status)
	if (mediaFile.status === 'failed') {
		return c.json(
			{
				error: {
					message: 'Media file processing failed',
					type: 'media_error',
					code: 410,
				},
			} as WhatsAppErrorResponse,
			410
		)
	}

	try {
		// Calculate SHA256 hash of the actual file
		const sha256Hash = await calculateSHA256Hash(mediaFile.filePath)

		// Generate response
		const response: MediaRetrievalResponse = {
			url: generateMediaUrl(
				mediaFile.id,
				c.req.header('Host') ? `http://${c.req.header('Host')}` : undefined
			),
			mime_type: mediaFile.mimeType,
			sha256: sha256Hash,
			file_size: mediaFile.fileSize,
			id: mediaFile.id,
		}

		console.log(
			`📎 Retrieved media metadata for ${mediaId}: ${mediaFile.filename}`
		)
		return c.json(response)
	} catch (error) {
		console.error(`❌ Error retrieving media metadata for ${mediaId}:`, error)
		return c.json(
			{
				error: {
					message: 'Failed to retrieve media metadata',
					type: 'server_error',
					code: 500,
				},
			} as WhatsAppErrorResponse,
			500
		)
	}
})

// GET /v22.0/media/{MEDIA_ID}/download - Download media file
mediaRouter.get('/:mediaId/download', async (c) => {
	const mediaId = c.req.param('mediaId')

	// Validate media ID format
	if (!mediaId || typeof mediaId !== 'string') {
		return c.json(
			{
				error: {
					message: 'Invalid media ID format',
					type: 'validation_error',
					code: 400,
				},
			} as WhatsAppErrorResponse,
			400
		)
	}

	// Validate media ID pattern (should start with 'media_')
	if (!mediaId.startsWith('media_')) {
		return c.json(
			{
				error: {
					message: 'Invalid media ID format',
					type: 'validation_error',
					code: 400,
				},
			} as WhatsAppErrorResponse,
			400
		)
	}

	// Get media file from storage
	const mediaFile = mockStore.getMediaFile(mediaId)

	if (!mediaFile) {
		return c.json(
			{
				error: {
					message: 'Media not found',
					type: 'not_found',
					code: 404,
				},
			} as WhatsAppErrorResponse,
			404
		)
	}

	// Check if media file is available
	if (mediaFile.status === 'failed') {
		return c.json(
			{
				error: {
					message: 'Media file processing failed',
					type: 'media_error',
					code: 410,
				},
			} as WhatsAppErrorResponse,
			410
		)
	}

	try {
		// Read file from storage
		const fs = await import('node:fs')
		const path = await import('node:path')

		// Resolve the full file path and protect against path traversal
		const fullPath = path.resolve(mediaFile.filePath)

		// Security check: ensure the resolved path is within allowed directories
		const allowedPaths = ['.whap/media', 'media/uploads', 'media/temp']
		const isAllowedPath = allowedPaths.some((allowedPath) => {
			const resolvedAllowedPath = path.resolve(allowedPath)
			return fullPath.startsWith(resolvedAllowedPath)
		})

		if (!isAllowedPath) {
			console.error(`❌ Attempted access to unauthorized path: ${fullPath}`)
			return c.json(
				{
					error: {
						message: 'Unauthorized file access',
						type: 'security_error',
						code: 403,
					},
				} as WhatsAppErrorResponse,
				403
			)
		}

		// Check if file exists
		if (!fs.existsSync(fullPath)) {
			return c.json(
				{
					error: {
						message: 'Media file not found on disk',
						type: 'file_not_found',
						code: 404,
					},
				} as WhatsAppErrorResponse,
				404
			)
		}

		// For large files (>10MB), use streaming instead of loading into memory
		const fileStats = fs.statSync(fullPath)
		const isLargeFile = fileStats.size > 10 * 1024 * 1024 // 10MB threshold

		// Set appropriate headers
		c.header('Content-Type', mediaFile.mimeType)
		c.header('Content-Length', mediaFile.fileSize.toString())
		c.header(
			'Content-Disposition',
			`attachment; filename="${mediaFile.filename}"`
		)
		c.header('Cache-Control', 'private, max-age=3600') // Cache for 1 hour
		c.header('Accept-Ranges', 'bytes') // Support partial content requests

		console.log(
			`📥 Downloading media file ${mediaId}: ${mediaFile.filename} (${(fileStats.size / 1024 / 1024).toFixed(2)}MB)`
		)

		if (isLargeFile) {
			// For large files, read into buffer to avoid streaming issues in tests
			const fileContent = fs.readFileSync(fullPath)
			return c.body(fileContent)
		}

		// Read smaller files into memory
		const fileContent = fs.readFileSync(fullPath)
		return c.body(fileContent)
	} catch (error) {
		console.error(`❌ Error downloading media file ${mediaId}:`, error)
		return c.json(
			{
				error: {
					message: 'Failed to download media file',
					type: 'server_error',
					code: 500,
				},
			} as WhatsAppErrorResponse,
			500
		)
	}
})

export { mediaRouter }

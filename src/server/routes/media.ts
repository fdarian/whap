import { Hono } from 'hono'
import { mockStore } from '../store/memory-store.ts'
import type { WhatsAppErrorResponse } from '../types/api-types.ts'

const mediaRouter = new Hono()

/** Response format for media retrieval API */
interface MediaRetrievalResponse {
	url: string
	mime_type: string
	sha256: string
	file_size: number
	id: string
}

/** Generate SHA256 hash placeholder for media file */
function generateSHA256Hash(filePath: string): string {
	// In a real implementation, this would calculate the actual SHA256 hash
	// For now, we'll generate a placeholder hash
	const crypto = require('node:crypto')
	return crypto.createHash('sha256').update(filePath).digest('hex')
}

/** Generate downloadable URL for media file */
function generateMediaUrl(mediaId: string, baseUrl?: string): string {
	// In a real implementation, this might be a signed URL with expiration
	// For now, we'll create a simple download URL
	const host = baseUrl || 'http://localhost:3010'
	return `${host}/v22.0/media/${mediaId}/download`
}

// GET /v22.0/{MEDIA_ID} - Retrieve media metadata
mediaRouter.get('/:mediaId', (c) => {
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

	// Generate response
	const response: MediaRetrievalResponse = {
		url: generateMediaUrl(mediaFile.id),
		mime_type: mediaFile.mimeType,
		sha256: generateSHA256Hash(mediaFile.filePath),
		file_size: mediaFile.fileSize,
		id: mediaFile.id,
	}

	console.log(
		`📎 Retrieved media metadata for ${mediaId}: ${mediaFile.filename}`
	)
	return c.json(response)
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

		// Resolve the full file path
		const fullPath = path.resolve(mediaFile.filePath)

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

		// Read file content
		const fileContent = fs.readFileSync(fullPath)

		// Set appropriate headers
		c.header('Content-Type', mediaFile.mimeType)
		c.header('Content-Length', mediaFile.fileSize.toString())
		c.header(
			'Content-Disposition',
			`attachment; filename="${mediaFile.filename}"`
		)
		c.header('Cache-Control', 'private, max-age=3600') // Cache for 1 hour

		console.log(`📥 Downloaded media file ${mediaId}: ${mediaFile.filename}`)

		// Return file content
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

import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { MediaMetadata } from '../types/api-types.ts'

/** Generate a unique media ID */
export function generateMediaId(): string {
	const timestamp = Date.now()
	const random = Math.random().toString(36).substring(2, 15)
	return `media_${timestamp}_${random}`
}

/** Get MIME type based on file extension */
export function getMimeType(filePath: string): string {
	const ext = extname(filePath).toLowerCase()
	const mimeTypes: Record<string, string> = {
		// Images
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.webp': 'image/webp', // Can be used for images and stickers
		// Documents
		'.pdf': 'application/pdf',
		'.doc': 'application/msword',
		'.docx':
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'.xls': 'application/vnd.ms-excel',
		'.xlsx':
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'.ppt': 'application/vnd.ms-powerpoint',
		'.pptx':
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'.txt': 'text/plain',
		// Audio
		'.mp3': 'audio/mpeg',
		'.wav': 'audio/wav',
		'.ogg': 'audio/ogg',
		'.m4a': 'audio/mp4',
		// Video
		'.mp4': 'video/mp4',
		'.avi': 'video/x-msvideo',
		'.mov': 'video/quicktime',
		'.wmv': 'video/x-ms-wmv',
	}

	return mimeTypes[ext] || 'application/octet-stream'
}

/** Determine media type based on MIME type */
export function getMediaType(
	mimeType: string
): 'image' | 'document' | 'audio' | 'video' | 'sticker' {
	if (mimeType.startsWith('image/')) {
		return 'image'
	}
	if (mimeType.startsWith('audio/')) {
		return 'audio'
	}
	if (mimeType.startsWith('video/')) {
		return 'video'
	}
	// For stickers, we'll consider them as image type for now
	// In a real implementation, you'd need more sophisticated logic
	return 'document'
}

/** Copy media file to storage directory and return metadata */
export function processMediaFile(
	filePath: string,
	caption?: string
): MediaMetadata {
	// Validate file exists
	if (!existsSync(filePath)) {
		throw new Error(`File not found: ${filePath}`)
	}

	// Get file stats
	const stats = statSync(filePath)
	const filename = basename(filePath)
	const mimeType = getMimeType(filePath)
	const mediaType = getMediaType(mimeType)

	// Generate unique media ID and storage path
	const mediaId = generateMediaId()
	const storageDir = '.whap/media'
	const fileExtension = extname(filename)
	const storedFilename = `${mediaId}${fileExtension}`
	const storedPath = join(storageDir, storedFilename)

	// Ensure storage directory exists
	if (!existsSync(storageDir)) {
		mkdirSync(storageDir, { recursive: true })
	}

	// Copy file to storage
	copyFileSync(filePath, storedPath)

	const metadata: MediaMetadata = {
		id: mediaId,
		originalPath: filePath,
		storedPath,
		filename,
		mimeType,
		size: stats.size,
		type: mediaType,
		caption,
		timestamp: new Date(),
	}

	console.log(`📎 Processed media file: ${filename} -> ${storedPath}`)
	return metadata
}

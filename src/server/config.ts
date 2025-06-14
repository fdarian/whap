export interface WebhookConfig {
	mappings: Map<string, string>
	fallbackUrl: string | null
}

export interface MediaConfig {
	/** Base directory for media storage */
	baseDir: string
	/** Directory for uploaded files */
	uploadsDir: string
	/** Directory for temporary files */
	tempDir: string
	/** Maximum file size in bytes (default: 10MB) */
	maxFileSize: number
	/** Allowed file extensions */
	allowedExtensions: string[]
	/** Allowed MIME types */
	allowedMimeTypes: string[]
}

/**
 * Parse CLI arguments for webhook URL mappings
 * Format: --webhook-url phone:url
 * Example: --webhook-url 1234567890:http://localhost:4000/webhook
 */
function parseWebhookMappings(): Map<string, string> {
	const mappings = new Map<string, string>()
	const args = process.argv.slice(2)

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--webhook-url' && i + 1 < args.length) {
			const mapping = args[i + 1]
			const colonIndex = mapping.indexOf(':')

			if (colonIndex === -1) {
				console.error(
					`❌ Invalid webhook URL format: ${mapping}. Expected format: phone:url`
				)
				process.exit(1)
			}

			const phone = mapping.substring(0, colonIndex).trim()
			const url = mapping.substring(colonIndex + 1).trim()

			if (!phone || !url) {
				console.error(
					`❌ Invalid webhook URL mapping: ${mapping}. Both phone and URL are required`
				)
				process.exit(1)
			}

			// Validate URL format
			try {
				new URL(url)
			} catch {
				console.error(`❌ Invalid URL format: ${url}`)
				process.exit(1)
			}

			if (mappings.has(phone)) {
				console.error(`❌ Duplicate phone number mapping: ${phone}`)
				process.exit(1)
			}

			mappings.set(phone, url)
			console.log(`🔗 Configured webhook URL for phone ${phone}: ${url}`)
			i++ // Skip the next argument since we consumed it
		}
	}

	return mappings
}

/**
 * Initialize webhook configuration from CLI arguments and environment variables
 */
function initializeWebhookConfig(): WebhookConfig {
	const mappings = parseWebhookMappings()
	const fallbackUrl = process.env.WEBHOOK_URL || null

	if (mappings.size === 0 && !fallbackUrl) {
		console.warn(
			'⚠️  No webhook URLs configured. Set WEBHOOK_URL environment variable or use --webhook-url CLI arguments'
		)
	} else if (fallbackUrl && mappings.size === 0) {
		console.log(`🔗 Using fallback webhook URL: ${fallbackUrl}`)
	}

	return {
		mappings,
		fallbackUrl,
	}
}

/**
 * Initialize media configuration with default values
 */
function initializeMediaConfig(): MediaConfig {
	const baseDir = process.env.MEDIA_DIR || './media'
	const maxFileSizeMB = process.env.MAX_FILE_SIZE_MB
		? Number.parseInt(process.env.MAX_FILE_SIZE_MB)
		: 10

	return {
		baseDir,
		uploadsDir: `${baseDir}/uploads`,
		tempDir: `${baseDir}/temp`,
		maxFileSize: maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
		allowedExtensions: [
			// Images
			'.jpg',
			'.jpeg',
			'.png',
			'.gif',
			'.webp',
			// Documents
			'.pdf',
			'.doc',
			'.docx',
			'.txt',
			'.csv',
			// Audio
			'.mp3',
			'.wav',
			'.ogg',
			'.m4a',
			// Video
			'.mp4',
			'.mov',
			'.avi',
			'.webm',
			// Other
			'.zip',
			'.rar',
		],
		allowedMimeTypes: [
			// Images
			'image/jpeg',
			'image/png',
			'image/gif',
			'image/webp',
			// Documents
			'application/pdf',
			'application/msword',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'text/plain',
			'text/csv',
			// Audio
			'audio/mpeg',
			'audio/wav',
			'audio/ogg',
			'audio/mp4',
			// Video
			'video/mp4',
			'video/quicktime',
			'video/x-msvideo',
			'video/webm',
			// Other
			'application/zip',
			'application/x-rar-compressed',
		],
	}
}

// Global configuration instances
let webhookConfig: WebhookConfig | null = null
const mediaConfig: MediaConfig = initializeMediaConfig()

/**
 * Get the global webhook configuration (lazy initialization)
 */
export function getWebhookConfig(): WebhookConfig {
	if (!webhookConfig) {
		webhookConfig = initializeWebhookConfig()
	}
	return webhookConfig
}

/**
 * Get the global media configuration
 */
export function getMediaConfig(): MediaConfig {
	return mediaConfig
}

/**
 * Get webhook URL for a specific phone number
 * @param phoneNumber - The phone number to get webhook URL for
 * @returns The webhook URL or null if not found
 */
export function getWebhookUrl(phoneNumber?: string): string | null {
	const config = getWebhookConfig()

	// If phone number is provided and we have a mapping for it, use it
	if (phoneNumber && config.mappings.has(phoneNumber)) {
		const url = config.mappings.get(phoneNumber)
		return url || null
	}

	// Otherwise, use the fallback URL
	return config.fallbackUrl
}

/**
 * Get all configured webhook mappings
 */
export function getAllWebhookMappings(): Array<{ phone: string; url: string }> {
	const config = getWebhookConfig()
	return Array.from(config.mappings.entries()).map(([phone, url]) => ({
		phone,
		url,
	}))
}

/**
 * Set or update the webhook URL mapping for a given phone number.
 * This utility is primarily used in test suites to override webhook targets at runtime.
 */
export function setWebhookUrl(phoneNumber: string, url: string): void {
	const config = getWebhookConfig()
	// Validate URL format (aligns with parseWebhookMappings)
	try {
		new URL(url)
	} catch {
		throw new Error(`Invalid URL format passed to setWebhookUrl: ${url}`)
	}
	config.mappings.set(phoneNumber, url)
}

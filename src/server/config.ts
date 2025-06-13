export interface WebhookConfig {
	mappings: Map<string, string>
	fallbackUrl: string | null
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
				throw new Error(`Duplicate phone number mapping: ${phone}`)
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

// Global configuration instance
let webhookConfig: WebhookConfig | null = null

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

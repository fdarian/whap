import {
	getWebhookMappingsFromConfig,
	parseWebhookEntry,
} from './configuration.ts'

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
 * Initialize webhook configuration from CLI arguments, environment variables, and config file
 * Priority order: CLI arguments > environment variables > config file
 * Environment variables can contain either "url" or "phone:url" format like CLI arguments
 */
function initializeWebhookConfig(): WebhookConfig {
	const cliMappings = parseWebhookMappings()

	// Parse environment variable for webhook URL
	let fallbackUrl: string | null = null
	const envWebhookUrl = process.env.WEBHOOK_URL
	if (envWebhookUrl) {
		const parsedEnv = parseWebhookEntry(envWebhookUrl)
		if (parsedEnv) {
			if (parsedEnv.phone) {
				// Environment variable contains phone:url mapping
				cliMappings.set(parsedEnv.phone, parsedEnv.url)
				console.log(
					`🔗 Configured webhook URL for phone ${parsedEnv.phone} from environment: ${parsedEnv.url}`
				)
			} else {
				// Environment variable contains fallback URL
				fallbackUrl = parsedEnv.url
			}
		} else {
			console.error(`❌ Invalid WEBHOOK_URL format: ${envWebhookUrl}`)
		}
	}

	// Load config file mappings and fallback URLs
	const configMappings = getWebhookMappingsFromConfig()

	// Merge CLI mappings with config file mappings (CLI takes precedence)
	const finalMappings = new Map(configMappings.mappings)
	for (const [phone, url] of cliMappings) {
		finalMappings.set(phone, url)
	}

	// If no env variable set, use the first fallback URL from config file
	if (!fallbackUrl && configMappings.fallbackUrls.length > 0) {
		fallbackUrl = configMappings.fallbackUrls[0]
		if (configMappings.fallbackUrls.length > 1) {
			console.log(
				`📄 Using first fallback webhook URL from config file: ${fallbackUrl}`
			)
			console.log(
				`📄 Additional fallback URLs in config file: ${configMappings.fallbackUrls.slice(1).join(', ')}`
			)
		} else {
			console.log(
				`📄 Using fallback webhook URL from config file: ${fallbackUrl}`
			)
		}
	}

	if (finalMappings.size === 0 && !fallbackUrl) {
		console.warn(
			'⚠️  No webhook URLs configured. Set WEBHOOK_URL environment variable, use --webhook-url CLI arguments, or create whap.json config file'
		)
	} else if (fallbackUrl && finalMappings.size === 0) {
		const source = process.env.WEBHOOK_URL
			? 'environment variable'
			: 'config file'
		console.log(`🔗 Using fallback webhook URL from ${source}: ${fallbackUrl}`)
	}

	return {
		mappings: finalMappings,
		fallbackUrl,
	}
}

// Global configuration instance
let webhookConfig: WebhookConfig | null = null

/**
 * Reset the global webhook configuration (useful for testing)
 */
export function resetWebhookConfig(): void {
	webhookConfig = null
}

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

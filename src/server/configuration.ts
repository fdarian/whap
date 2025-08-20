import fs from 'node:fs'
import path from 'node:path'

export interface WhapConfiguration {
	webhookUrls?: string[]
}

export interface ParsedWebhookMapping {
	phone?: string
	url: string
}

/**
 * Parse webhook entry that can be either "url" or "phone:url" format
 * @param entry - The webhook entry string
 * @returns Parsed mapping or null if invalid
 */
export function parseWebhookEntry(entry: string): ParsedWebhookMapping | null {
	// First, try to parse as a direct URL (must start with http:// or https://)
	if (entry.startsWith('http://') || entry.startsWith('https://')) {
		try {
			new URL(entry)
			return { url: entry }
		} catch {
			// Invalid URL format
			return null
		}
	}

	// Look for phone:url format - find the first colon that's not part of http:// or https://
	const httpIndex = entry.indexOf('http')
	let colonIndex = -1

	if (httpIndex === -1) {
		// No http protocol, so any colon could be the separator
		colonIndex = entry.indexOf(':')
	} else {
		// Find colon before http
		colonIndex = entry.substring(0, httpIndex).lastIndexOf(':')
	}

	if (colonIndex === -1) {
		return null
	}

	const phone = entry.substring(0, colonIndex).trim()
	const url = entry.substring(colonIndex + 1).trim()

	if (!phone || !url) {
		return null
	}

	try {
		new URL(url)
		return { phone, url }
	} catch {
		return null
	}
}

/**
 * Load configuration from whap.json file in current working directory
 * @returns Configuration object or null if file doesn't exist or is invalid
 */
function loadConfigFile(): WhapConfiguration | null {
	const configPath = path.join(process.cwd(), 'whap.json')

	try {
		if (!fs.existsSync(configPath)) {
			return null
		}

		const fileContent = fs.readFileSync(configPath, 'utf-8')
		const config = JSON.parse(fileContent) as WhapConfiguration

		// Validate webhookUrls array if present
		if (config.webhookUrls && !Array.isArray(config.webhookUrls)) {
			console.error('❌ Invalid whap.json: webhookUrls must be an array')
			return null
		}

		// Validate URLs in webhookUrls array (can be "url" or "phone:url" format)
		if (config.webhookUrls) {
			for (const entry of config.webhookUrls) {
				if (typeof entry !== 'string') {
					console.error(
						'❌ Invalid whap.json: webhookUrls must contain only strings'
					)
					return null
				}

				// Parse phone:url or just url format
				const parsed = parseWebhookEntry(entry)
				if (!parsed) {
					console.error(`❌ Invalid whap.json: invalid format: ${entry}`)
					return null
				}
			}
		}

		console.log(`📄 Loaded configuration from ${configPath}`)
		return config
	} catch (error) {
		console.error(`❌ Failed to load whap.json: ${error}`)
		return null
	}
}

/**
 * Get webhook mappings from configuration file
 * @returns Object with phone mappings and fallback URLs
 */
export function getWebhookMappingsFromConfig(): {
	mappings: Map<string, string>
	fallbackUrls: string[]
} {
	const mappings = new Map<string, string>()
	const fallbackUrls: string[] = []

	const config = loadConfigFile()
	if (config?.webhookUrls) {
		for (const entry of config.webhookUrls) {
			const parsed = parseWebhookEntry(entry)
			if (parsed) {
				if (parsed.phone) {
					mappings.set(parsed.phone, parsed.url)
					console.log(
						`🔗 Configured webhook URL for phone ${parsed.phone}: ${parsed.url}`
					)
				} else {
					fallbackUrls.push(parsed.url)
				}
			}
		}
	}

	return { mappings, fallbackUrls }
}

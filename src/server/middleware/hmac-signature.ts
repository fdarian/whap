/**
 * WhatsApp HMAC Signature Utilities
 *
 * WhatsApp signs every outgoing webhook Event Notification payload with
 * HMAC-SHA256 and includes the signature in the `X-Hub-Signature-256`
 * request header.
 *
 * Official specification:
 *   https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 *
 * Algorithm:
 *   1. Serialise the request body to a UTF-8 string with non-ASCII characters
 *      escaped as \uXXXX (matching Meta's server-side serialisation format).
 *   2. Compute HMAC-SHA256 of those bytes using the app secret as the key.
 *   3. Prepend `sha256=` to produce the header value.
 *
 * HMAC computation:
 *   We use `Bun.CryptoHasher` with a secret key – the Bun-native HMAC API
 *   documented at https://bun.sh/docs/api/hashing#hmac-in-bun-cryptohasher.
 *
 * Unicode escaping:
 *   Meta's servers escape all non-ASCII characters (code points > U+007F) as
 *   \uXXXX before computing the HMAC. For characters outside the BMP (emoji,
 *   etc.) the UTF-16 surrogate pair is escaped as two \uXXXX sequences,
 *   matching JSON.stringify behaviour for those code points.
 */

export const SIGNATURE_HEADER = 'x-hub-signature-256'
const SIGNATURE_PREFIX = 'sha256='

/**
 * Serialise a JSON value to a string with all non-ASCII characters escaped as
 * \uXXXX sequences, matching Meta's WhatsApp webhook serialisation format.
 *
 * Characters in the range U+0000–U+007F are passed through as-is (including
 * the standard JSON escape sequences already produced by JSON.stringify).
 * Characters above U+007F are replaced with \uXXXX. For code points outside
 * the BMP (> U+FFFF), JSON.stringify already emits two surrogate escapes, so
 * this function only needs to handle the two-byte range U+0080–U+FFFF.
 */
export function serializeJsonWithEscapedUnicode(value: unknown): string {
	const raw = JSON.stringify(value)
	let result = ''
	for (let i = 0; i < raw.length; i++) {
		const code = raw.charCodeAt(i)
		if (code > 0x007f) {
			result += `\\u${code.toString(16).padStart(4, '0')}`
		} else {
			result += raw[i]
		}
	}
	return result
}

/**
 * Compute HMAC-SHA256 of `body` using `secret` as the key.
 *
 * Uses `Bun.CryptoHasher` — the Bun-native HMAC API.
 * Returns the full header value in `sha256=<hex>` format, ready to be set
 * directly as the `X-Hub-Signature-256` header.
 */
export function computeHmacSignatureHeader(
	secret: string,
	body: string
): string {
	const hasher = new Bun.CryptoHasher('sha256', secret)
	hasher.update(body)
	return `${SIGNATURE_PREFIX}${hasher.digest('hex')}`
}

/**
 * Compute the raw HMAC-SHA256 digest bytes of `body` using `secret` as the
 * key. Returns a 32-byte Uint8Array.
 */
function computeHmacDigestBytes(secret: string, body: string): Uint8Array {
	const hasher = new Bun.CryptoHasher('sha256', secret)
	hasher.update(body)
	return hasher.digest()
}

/**
 * Verify an incoming `X-Hub-Signature-256` header value against the expected
 * signature computed from `secret` and `body`.
 *
 * Performs timing-safe comparison by computing both HMAC digests as raw bytes
 * and XOR-ing every byte, accumulating into a single value. This ensures the
 * comparison always visits all 32 bytes regardless of where a difference
 * occurs, preventing timing side-channel attacks.
 *
 * The incoming header must be in `sha256=<64 hex chars>` format. Returns
 * `false` for any malformed or length-mismatched input.
 */
export function verifyHmacSignature(
	headerValue: string,
	secret: string,
	body: string
): boolean {
	if (!headerValue.startsWith(SIGNATURE_PREFIX)) {
		return false
	}
	const incomingHex = headerValue.slice(SIGNATURE_PREFIX.length)
	// A SHA-256 hex digest is always exactly 64 characters.
	if (incomingHex.length !== 64) {
		return false
	}

	const expectedBytes = computeHmacDigestBytes(secret, body)

	// Decode the incoming hex string to bytes without early exit.
	const incomingBytes = new Uint8Array(32)
	for (let i = 0; i < 32; i++) {
		incomingBytes[i] = parseInt(incomingHex.slice(i * 2, i * 2 + 2), 16)
	}

	// XOR all bytes and OR the results — never short-circuit.
	let diff = 0
	for (let i = 0; i < 32; i++) {
		diff |= incomingBytes[i] ^ expectedBytes[i]
	}
	return diff === 0
}

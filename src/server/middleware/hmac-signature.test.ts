/**
 * Tests for the HMAC signature utility used to inject `X-Hub-Signature-256`
 * into outgoing webhook requests.
 *
 * These tests verify that `computeHmacSignatureHeader` produces values that
 * conform to the WhatsApp webhook signature specification:
 *   https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */

import { describe, expect, test } from 'vitest'
import {
	computeHmacSignatureHeader,
	SIGNATURE_HEADER,
	serializeJsonWithEscapedUnicode,
	verifyHmacSignature,
} from './hmac-signature.ts'

const TEST_SECRET = 'test-app-secret'
const TEST_BODY = JSON.stringify({ object: 'whatsapp_business_account' })

describe('computeHmacSignatureHeader', () => {
	test('returns a value prefixed with sha256=', () => {
		const header = computeHmacSignatureHeader(TEST_SECRET, TEST_BODY)
		expect(header).toMatch(/^sha256=[0-9a-f]{64}$/)
	})

	test('produces a deterministic digest for the same secret and body', () => {
		const first = computeHmacSignatureHeader(TEST_SECRET, TEST_BODY)
		const second = computeHmacSignatureHeader(TEST_SECRET, TEST_BODY)
		expect(first).toBe(second)
	})

	test('produces different digests for different secrets', () => {
		const a = computeHmacSignatureHeader('secret-a', TEST_BODY)
		const b = computeHmacSignatureHeader('secret-b', TEST_BODY)
		expect(a).not.toBe(b)
	})

	test('produces different digests for different bodies', () => {
		const a = computeHmacSignatureHeader(TEST_SECRET, TEST_BODY)
		const b = computeHmacSignatureHeader(
			TEST_SECRET,
			JSON.stringify({ object: 'different' })
		)
		expect(a).not.toBe(b)
	})

	test('handles an empty body', () => {
		const header = computeHmacSignatureHeader(TEST_SECRET, '')
		expect(header).toMatch(/^sha256=[0-9a-f]{64}$/)
	})

	test('round-trips: digest computed independently with Bun.CryptoHasher matches', () => {
		const hasher = new Bun.CryptoHasher('sha256', TEST_SECRET)
		hasher.update(TEST_BODY)
		const expected = `sha256=${hasher.digest('hex')}`

		const actual = computeHmacSignatureHeader(TEST_SECRET, TEST_BODY)
		expect(actual).toBe(expected)
	})
})

describe('SIGNATURE_HEADER constant', () => {
	test('is the lowercase header name expected by the WhatsApp spec', () => {
		expect(SIGNATURE_HEADER).toBe('x-hub-signature-256')
	})
})

describe('computeHmacSignatureHeader — known test vector', () => {
	// Vector independently verified with:
	//   echo -n '{"object":"whatsapp_business_account"}' | openssl dgst -sha256 -hmac 'test-app-secret'
	// Output: b6978b21c4467654c466607663db9b43fae44b71083568df403e0a077089208e
	test('matches the independently-computed openssl reference digest', () => {
		const body = '{"object":"whatsapp_business_account"}'
		const header = computeHmacSignatureHeader('test-app-secret', body)
		expect(header).toBe(
			'sha256=b6978b21c4467654c466607663db9b43fae44b71083568df403e0a077089208e'
		)
	})
})

describe('serializeJsonWithEscapedUnicode', () => {
	test('passes through a purely ASCII JSON string unchanged', () => {
		const input = { object: 'whatsapp_business_account' }
		expect(serializeJsonWithEscapedUnicode(input)).toBe(
			'{"object":"whatsapp_business_account"}'
		)
	})

	test('escapes é (U+00E9) as \\u00e9', () => {
		const result = serializeJsonWithEscapedUnicode({ message: 'café' })
		expect(result).toBe('{"message":"caf\\u00e9"}')
	})

	test('escapes ñ (U+00F1) as \\u00f1', () => {
		const result = serializeJsonWithEscapedUnicode({ message: 'ñ' })
		expect(result).toBe('{"message":"\\u00f1"}')
	})

	test('escapes ü (U+00FC) as \\u00fc', () => {
		const result = serializeJsonWithEscapedUnicode({ message: 'ü' })
		expect(result).toBe('{"message":"\\u00fc"}')
	})

	test('escapes emoji (U+1F355) as UTF-16 surrogate pair \\uD83C\\uDF55', () => {
		// U+1F355 SLICE OF PIZZA — above BMP, stored as two UTF-16 surrogates in
		// JS strings (D83C + DF55). Both code units are > 0x7F so the serialiser
		// escapes each one independently, matching Meta's server behaviour.
		const result = serializeJsonWithEscapedUnicode({ message: '\u{1F355}' })
		expect(result).toBe('{"message":"\\ud83c\\udf55"}')
	})

	test('leaves ASCII characters unchanged when mixed with non-ASCII', () => {
		const result = serializeJsonWithEscapedUnicode({ text: 'hello é' })
		expect(result).toBe('{"text":"hello \\u00e9"}')
	})

	test('handles multiple non-ASCII characters in a single string', () => {
		const result = serializeJsonWithEscapedUnicode({ text: 'éñü' })
		expect(result).toBe('{"text":"\\u00e9\\u00f1\\u00fc"}')
	})

	test('handles an object with no non-ASCII content', () => {
		const result = serializeJsonWithEscapedUnicode({ a: 1, b: 'hello' })
		expect(result).toBe('{"a":1,"b":"hello"}')
	})
})

describe('computeHmacSignatureHeader — unicode bodies', () => {
	// These vectors confirm that when the serialiser escapes non-ASCII chars
	// the HMAC is computed over the \uXXXX-escaped bytes, not the raw UTF-8 bytes.
	// Each expected value was independently verified with Python's hmac module.

	test('produces correct digest for body containing é (U+00E9)', () => {
		// serializeJsonWithEscapedUnicode({message:'café'}) = '{"message":"caf\\u00e9"}'
		const body = '{"message":"caf\\u00e9"}'
		const header = computeHmacSignatureHeader(TEST_SECRET, body)
		expect(header).toBe(
			'sha256=5980113abfc4ffe911f1ae78f92dcf41e10b7d6bc792efd48dfe9ee94131aaf4'
		)
	})

	test('produces correct digest for body containing ñ (U+00F1)', () => {
		const body = '{"message":"\\u00f1"}'
		const header = computeHmacSignatureHeader(TEST_SECRET, body)
		expect(header).toBe(
			'sha256=354180ffbc36b3aa59251edd86d5ebbd4b96f6b0e8b86c0e33de972ed522b4a9'
		)
	})

	test('produces correct digest for body containing ü (U+00FC)', () => {
		const body = '{"message":"\\u00fc"}'
		const header = computeHmacSignatureHeader(TEST_SECRET, body)
		expect(header).toBe(
			'sha256=4d9bf627365de9d0375f6bf7d097103d0707887ac70b7e7f89eee7149785d456'
		)
	})

	test('produces correct digest for body containing emoji surrogate pair', () => {
		// U+1F355 serialised as \uD83C\uDF55
		const body = '{"message":"\\ud83c\\udf55"}'
		const header = computeHmacSignatureHeader(TEST_SECRET, body)
		expect(header).toBe(
			'sha256=a3fe6b4ad5e3ef4df08e3dd66f4ed304d3ad5b34bb9da8f1da445acc6088a507'
		)
	})

	test('produces correct digest for mixed ASCII and non-ASCII body', () => {
		const body = '{"text":"hello \\u00e9"}'
		const header = computeHmacSignatureHeader(TEST_SECRET, body)
		expect(header).toBe(
			'sha256=332fbd50e77a205c8668b7d665d0c0abdf38c6770cbd1fbfebc5854d60859da0'
		)
	})

	test('escaped body produces a different digest than the raw UTF-8 body', () => {
		// This is the critical regression guard: the HMAC of the \uXXXX-escaped
		// form must differ from the HMAC of the raw UTF-8 bytes so we can detect
		// if the serialiser is accidentally bypassed.
		const rawUtf8Body = '{"message":"café"}' // raw UTF-8 bytes for é
		const escapedBody = '{"message":"caf\\u00e9"}' // \uXXXX form
		const hmacRaw = computeHmacSignatureHeader(TEST_SECRET, rawUtf8Body)
		const hmacEscaped = computeHmacSignatureHeader(TEST_SECRET, escapedBody)
		expect(hmacRaw).not.toBe(hmacEscaped)
	})
})

describe('verifyHmacSignature', () => {
	test('returns true for a matching signature', () => {
		const header = computeHmacSignatureHeader(TEST_SECRET, TEST_BODY)
		expect(verifyHmacSignature(header, TEST_SECRET, TEST_BODY)).toBe(true)
	})

	test('returns false for an incorrect signature', () => {
		expect(verifyHmacSignature('sha256=deadbeef', TEST_SECRET, TEST_BODY)).toBe(
			false
		)
	})

	test('returns false when the secret is wrong', () => {
		const header = computeHmacSignatureHeader('wrong-secret', TEST_BODY)
		expect(verifyHmacSignature(header, TEST_SECRET, TEST_BODY)).toBe(false)
	})

	test('returns false when the body is different', () => {
		const header = computeHmacSignatureHeader(TEST_SECRET, TEST_BODY)
		expect(
			verifyHmacSignature(header, TEST_SECRET, '{"object":"different"}')
		).toBe(false)
	})

	test('returns false for a header with a different length', () => {
		// Ensures the length-check short-circuit works before timingSafeEqual
		expect(verifyHmacSignature('sha256=short', TEST_SECRET, TEST_BODY)).toBe(
			false
		)
	})
})

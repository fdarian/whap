import { Hono } from "hono";
import { validator } from "hono/validator";
import { getWebhookUrl } from "../config.ts";
import { mockStore } from "../store/memory-store.ts";
import type {
	WebhookPayload,
	WhatsAppErrorResponse,
	WhatsAppSendMessageRequest,
	WhatsAppSendMessageResponse,
	WhatsAppTypingRequest,
	WhatsAppTypingResponse,
} from "../types/api-types.ts";
import {
	validateWhatsAppMessageRequest,
	validateWhatsAppTypingRequest,
	formatValidationErrorForAPI,
} from "../utils/validator.ts";
import { broadcast } from "../websocket.ts";

const messagesRouter = new Hono();

// Helper function to send webhook
async function sendWebhook(
	url: string,
	payload: WebhookPayload,
): Promise<void> {
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "WhatsApp-Mock-Server/1.0",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		console.log(`✅ Webhook delivered successfully to ${url}`);
	} catch (error) {
		console.error(`❌ Failed to deliver webhook to ${url}:`, error);
		throw error;
	}
}

// Auto-send delivery status webhook
function sendDeliveryStatusWebhook(
	messageId: string,
	phoneNumberId: string,
	to: string,
	status: "sent" | "delivered" | "read",
): void {
	const webhookUrl = getWebhookUrl(phoneNumberId);
	if (!webhookUrl) return;

	const payload: WebhookPayload = {
		object: "whatsapp_business_account",
		entry: [
			{
				id: phoneNumberId,
				changes: [
					{
						value: {
							messaging_product: "whatsapp",
							metadata: {
								display_phone_number: phoneNumberId,
								phone_number_id: phoneNumberId,
							},
							statuses: [
								{
									id: messageId,
									status,
									timestamp: Math.floor(Date.now() / 1000).toString(),
									recipient_id: to,
								},
							],
						},
						field: "messages",
					},
				],
			},
		],
	};

	sendWebhook(webhookUrl, payload).catch((error) => {
		console.error(`❌ Delivery status webhook failed: ${error.message}`);
	});
}

/** Check if request is a typing indicator using JSON schema validation */
function isTypingIndicatorRequest(
	body: unknown,
): body is WhatsAppTypingRequest {
	const typingResult = validateWhatsAppTypingRequest(body);
	return typingResult.isValid;
}

/** Validation middleware for send message request using Ajv */
const validateSendMessage = validator("json", (value, c) => {
	// First try to validate as a typing indicator request
	const typingResult = validateWhatsAppTypingRequest(value);
	if (typingResult.isValid && typingResult.data) {
		return typingResult.data;
	}

	// Then try to validate as a message request
	const messageResult = validateWhatsAppMessageRequest(value);
	if (messageResult.isValid && messageResult.data) {
		return messageResult.data;
	}

	// If neither validation passes, return error response
	const errorMessage = formatValidationErrorForAPI(
		messageResult.errors || [
			{ path: "root", message: "Invalid request format" },
		],
	);

	return c.json(
		{
			error: {
				message: errorMessage,
				type: "validation_error",
				code: 400,
			},
		} as WhatsAppErrorResponse,
		400,
	);
});

// POST /v22.0/{phone-number-id}/messages - Send message or typing indicator
messagesRouter.post(
	"/:phoneNumberId/messages",
	validateSendMessage,
	async (c) => {
		const { phoneNumberId } = c.req.param();
		const body = c.req.valid("json");

		// Check if this is a typing indicator request
		if (isTypingIndicatorRequest(body)) {
			console.log(
				`⌨️ Typing indicator for message ${body.message_id} on ${phoneNumberId}`,
			);

			// Store typing status temporarily (will expire after 25 seconds)
			mockStore.setTypingIndicator(phoneNumberId, body.message_id, true);

			// Broadcast typing status to CLI
			broadcast({
				type: "TYPING_INDICATOR",
				payload: {
					phoneNumberId,
					messageId: body.message_id,
					isTyping: true,
					timestamp: Date.now(),
				},
			});

			// Auto-clear typing indicator after 25 seconds (as per WhatsApp specs)
			setTimeout(() => {
				mockStore.setTypingIndicator(phoneNumberId, body.message_id, false);
				broadcast({
					type: "TYPING_INDICATOR",
					payload: {
						phoneNumberId,
						messageId: body.message_id,
						isTyping: false,
						timestamp: Date.now(),
					},
				});
			}, 25000);

			const response: WhatsAppTypingResponse = {
				success: true,
			};

			return c.json(response);
		}

		// Otherwise handle as regular message
		const messageBody = body as WhatsAppSendMessageRequest;

		// Store the message
		const storedMessage = mockStore.storeMessage({
			phoneNumberId,
			to: messageBody.to,
			type: messageBody.type,
			content: {
				...(messageBody.text && { text: messageBody.text }),
				...(messageBody.template && { template: messageBody.template }),
			},
		});

		// Broadcast that a new message was sent
		broadcast({
			type: "NEW_MESSAGE",
			payload: storedMessage,
		});

		// Simulate webhook for delivery status (sent -> delivered -> read)
		setTimeout(
			() =>
				sendDeliveryStatusWebhook(
					storedMessage.id,
					phoneNumberId,
					messageBody.to,
					"sent",
				),
			1000,
		);

		setTimeout(() => {
			mockStore.updateMessageStatus(storedMessage.id, "delivered");
			sendDeliveryStatusWebhook(
				storedMessage.id,
				phoneNumberId,
				messageBody.to,
				"delivered",
			);
		}, 2000);

		setTimeout(() => {
			mockStore.updateMessageStatus(storedMessage.id, "read");
			sendDeliveryStatusWebhook(
				storedMessage.id,
				phoneNumberId,
				messageBody.to,
				"read",
			);
		}, 3000);

		// Simulate API response
		const response: WhatsAppSendMessageResponse = {
			messaging_product: "whatsapp",
			contacts: [{ input: messageBody.to, wa_id: messageBody.to }],
			messages: [
				{
					id: storedMessage.id,
				},
			],
		};

		return c.json(response);
	},
);

// POST /v22.0/{phone-number-id}/typing - Send typing indicator (dedicated endpoint)
messagesRouter.post("/:phoneNumberId/typing", async (c) => {
	try {
		const body = (await c.req.json()) as WhatsAppTypingRequest;
		const phoneNumberId = c.req.param("phoneNumberId");

		// Validate typing request
		if (body.status === "read" && body.message_id && body.typing_indicator) {
			console.log(
				`⌨️ Typing indicator for message ${body.message_id} on ${phoneNumberId}`,
			);

			// Store typing status temporarily (will expire after 25 seconds)
			mockStore.setTypingIndicator(phoneNumberId, body.message_id, true);

			// Broadcast typing status to CLI
			broadcast({
				type: "TYPING_INDICATOR",
				payload: {
					phoneNumberId,
					messageId: body.message_id,
					isTyping: true,
					timestamp: Date.now(),
				},
			});

			// Auto-clear typing indicator after 25 seconds (as per WhatsApp specs)
			setTimeout(() => {
				mockStore.setTypingIndicator(phoneNumberId, body.message_id, false);
				broadcast({
					type: "TYPING_INDICATOR",
					payload: {
						phoneNumberId,
						messageId: body.message_id,
						isTyping: false,
						timestamp: Date.now(),
					},
				});
			}, 25000);

			const response: WhatsAppTypingResponse = {
				success: true,
			};

			return c.json(response);
		}
		return c.json(
			{
				error: {
					message: "Invalid typing indicator request format",
					type: "validation_error",
					code: 400,
				},
			} as WhatsAppErrorResponse,
			400,
		);
	} catch (error) {
		console.error("❌ Typing indicator error:", error);
		return c.json(
			{
				error: {
					message: "Failed to process typing indicator",
					type: "server_error",
					code: 500,
				},
			} as WhatsAppErrorResponse,
			500,
		);
	}
});

// GET /v22.0/{phone-number-id}/messages - Get messages (mock endpoint for testing)
messagesRouter.get("/:phoneNumberId/messages", (c) => {
	const phoneNumberId = c.req.param("phoneNumberId");
	const messages = mockStore.getMessagesForPhoneNumber(phoneNumberId);

	return c.json({
		data: messages,
		paging: {
			cursors: {
				before: "mock-cursor-before",
				after: "mock-cursor-after",
			},
		},
	});
});

// GET /v22.0/{phone-number-id}/messages/{message-id} - Get specific message
messagesRouter.get("/:phoneNumberId/messages/:messageId", (c) => {
	const messageId = c.req.param("messageId");
	const message = mockStore.getMessage(messageId);

	if (!message) {
		return c.json(
			{
				error: {
					message: "Message not found",
					type: "not_found",
					code: 404,
				},
			} as WhatsAppErrorResponse,
			404,
		);
	}

	return c.json(message);
});

export { messagesRouter };

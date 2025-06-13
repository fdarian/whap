// WhatsApp Cloud API Types for Mock Server

export interface WhatsAppSendMessageRequest {
	messaging_product: 'whatsapp'
	to: string
	type: 'text' | 'template'
	text?: {
		body: string
	}
	template?: {
		name: string
		language: { code: string }
		components?: Array<{
			type: 'body'
			parameters: Array<{
				type: 'text'
				parameter_name: string
				text: string
			}>
		}>
	}
}

export interface WhatsAppSendMessageResponse {
	messaging_product: string
	contacts?: Array<{
		input: string
		wa_id: string
	}>
	messages?: Array<{
		id: string
	}>
}

export interface WhatsAppTypingRequest {
	messaging_product: 'whatsapp'
	status: 'read'
	message_id: string
	typing_indicator: {
		type: 'text'
	}
}

export interface WhatsAppTypingResponse {
	success: boolean
}

export interface WhatsAppErrorResponse {
	error: {
		message: string
		type: string
		code: number
		error_subcode?: number
		fbtrace_id?: string
	}
}

// Webhook simulation types
export interface WebhookConfiguration {
	url: string
	verify_token?: string
	enabled: boolean
	phoneNumberId: string
}

export interface SimulateMessageParams {
	from: string
	to: string
	message: {
		id: string
		type: 'text'
		timestamp: string
		text: {
			body: string
		}
	}
}

export interface WebhookPayload {
	object: 'whatsapp_business_account'
	entry: Array<{
		id: string
		changes: Array<{
			value: {
				messaging_product: 'whatsapp'
				metadata: {
					display_phone_number: string
					phone_number_id: string
				}
				contacts?: Array<{
					profile?: { name: string }
					wa_id: string
				}>
				messages?: Array<
					({
						from: string
						id: string
						timestamp: string
					} & (
						| {
								text: { body: string }
								type: 'text'
						  }
						| {
								type: string
						  }
					)) & {
						context?: {
							id: string
							from?: string
							forwarded?: boolean
							frequently_forwarded?: boolean
						}
					}
				>
				statuses?: Array<{
					id: string
					status: 'sent' | 'delivered' | 'read'
					timestamp: string
					recipient_id: string
				}>
			}
			field: 'messages'
		}>
	}>
}

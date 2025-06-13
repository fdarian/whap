// WhatsApp Cloud API Types for Mock Server

/** Template structure based on WhatsApp Business API format */
export interface Template {
	name: string
	language: string
	category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
	components: TemplateComponent[]
	variables?: Record<
		string,
		{
			description: string
			example: string
		}
	>
}

export interface TemplateComponent {
	type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
	format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
	text?: string
	buttons?: Array<{
		type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
		text: string
		url?: string
		phone_number?: string
	}>
}

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

/** Standard message status update payload */
export interface MessageStatusUpdate {
	id: string
	status: 'sent' | 'delivered' | 'read' | 'failed'
	timestamp: string
	recipient_id: string
	conversation?: {
		id: string
		expiration_timestamp: string
		origin: {
			type: string
		}
	}
	pricing?: {
		category: string
		pricing_model: string
	}
}

/** Template-specific message status update with template metadata */
export interface TemplateMessageStatusUpdate extends MessageStatusUpdate {
	template?: {
		name: string
		language: string
		category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
	}
	/** Template processing error details for failed status */
	error?: {
		code: string
		title: string
		message: string
		error_data?: {
			details?: string
		}
	}
}

/** Template approval/rejection status update */
export interface TemplateStatusUpdate {
	event: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'
	message_template_id: string
	message_template_name: string
	message_template_language: string
	category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
	reason?: string
	status_details?: string
	timestamp: string
	/** Additional error details for rejected templates */
	errors?: Array<{
		code: string
		title: string
		message: string
		error_data?: {
			component_index?: number
			button_position?: number
			details?: string
		}
	}>
}

export interface WebhookPayload {
	object: 'whatsapp_business_account'
	entry: Array<{
		id: string
		changes: Array<{
			value:
				| {
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
						/** Standard message delivery statuses */
						statuses?: MessageStatusUpdate[]
						/** Template-specific message delivery statuses */
						template_statuses?: TemplateMessageStatusUpdate[]
				  }
				| ({
						/** Template approval/rejection status updates */
						messaging_product: 'whatsapp'
						metadata: {
							display_phone_number: string
							phone_number_id: string
						}
				  } & TemplateStatusUpdate)
			field: 'messages' | 'message_template_status_update'
		}>
	}>
}

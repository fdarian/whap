import Ajv, { type JSONSchemaType, type Schema } from 'ajv'
import addFormats from 'ajv-formats'
import type {
	Template,
	WhatsAppSendMessageRequest,
	WhatsAppTypingRequest,
} from '../types/api-types.ts'

/** Initialize Ajv with formats */
const ajv = new Ajv({ allErrors: true, verbose: true })
addFormats(ajv)

/** Schema for WhatsApp Send Message Request */
const whatsAppSendMessageSchema: JSONSchemaType<WhatsAppSendMessageRequest> = {
	type: 'object',
	properties: {
		messaging_product: {
			type: 'string',
			const: 'whatsapp',
		},
		to: {
			type: 'string',
			minLength: 1,
		},
		type: {
			type: 'string',
			enum: ['text', 'template'],
		},
		text: {
			type: 'object',
			properties: {
				body: {
					type: 'string',
					minLength: 1,
				},
			},
			required: ['body'],
			nullable: true,
		},
		template: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					minLength: 1,
				},
				language: {
					type: 'object',
					properties: {
						code: {
							type: 'string',
							minLength: 1,
						},
					},
					required: ['code'],
				},
				components: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								const: 'body',
							},
							parameters: {
								type: 'array',
								items: {
									type: 'object',
									properties: {
										type: {
											type: 'string',
											const: 'text',
										},
										parameter_name: {
											type: 'string',
										},
										text: {
											type: 'string',
										},
									},
									required: ['type', 'parameter_name', 'text'],
								},
							},
						},
						required: ['type', 'parameters'],
					},
					nullable: true,
				},
			},
			required: ['name', 'language'],
			nullable: true,
		},
	},
	required: ['messaging_product', 'to', 'type'],
	anyOf: [
		{
			properties: {
				type: { const: 'text' },
				text: { type: 'object', nullable: false },
			},
			required: ['text'],
		},
		{
			properties: {
				type: { const: 'template' },
				template: { type: 'object', nullable: false },
			},
			required: ['template'],
		},
	],
}

/** Schema for WhatsApp Typing Request */
const whatsAppTypingSchema: JSONSchemaType<WhatsAppTypingRequest> = {
	type: 'object',
	properties: {
		messaging_product: {
			type: 'string',
			const: 'whatsapp',
		},
		status: {
			type: 'string',
			const: 'read',
		},
		message_id: {
			type: 'string',
			minLength: 1,
		},
		typing_indicator: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'text',
				},
			},
			required: ['type'],
		},
	},
	required: ['messaging_product', 'status', 'message_id', 'typing_indicator'],
}

/** Schema for Template */
const templateSchema: JSONSchemaType<Template> = {
	type: 'object',
	properties: {
		name: {
			type: 'string',
			minLength: 1,
		},
		language: {
			type: 'string',
			minLength: 1,
		},
		category: {
			type: 'string',
			enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
		},
		components: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						enum: ['HEADER', 'BODY', 'FOOTER', 'BUTTONS'],
					},
					format: {
						type: 'string',
						enum: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'],
						nullable: true,
					},
					text: {
						type: 'string',
						nullable: true,
					},
					buttons: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								type: {
									type: 'string',
									enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'],
								},
								text: {
									type: 'string',
								},
								url: {
									type: 'string',
									nullable: true,
								},
								phone_number: {
									type: 'string',
									nullable: true,
								},
							},
							required: ['type', 'text'],
						},
						nullable: true,
					},
				},
				required: ['type'],
			},
		},
		variables: {
			type: 'object',
			patternProperties: {
				'^.*$': {
					type: 'object',
					properties: {
						description: {
							type: 'string',
						},
						example: {
							type: 'string',
						},
					},
					required: ['description', 'example'],
				},
			},
			nullable: true,
		},
	},
	required: ['name', 'language', 'category', 'components'],
}

/** Compile schemas */
const validateWhatsAppMessage = ajv.compile(whatsAppSendMessageSchema)
const validateWhatsAppTyping = ajv.compile(whatsAppTypingSchema)
const validateTemplate = ajv.compile(templateSchema)

/** Validation result interface */
export interface ValidationResult<T> {
	isValid: boolean
	data?: T
	errors?: ValidationError[]
}

export interface ValidationError {
	path: string
	message: string
	value?: unknown
}

/** Convert Ajv errors to more readable format */
function formatAjvErrors(errors: Ajv.ErrorObject[]): ValidationError[] {
	return errors.map((error) => ({
		path: error.instancePath || 'root',
		message: error.message || 'Unknown validation error',
		value: error.data,
	}))
}

/** Validate WhatsApp message request */
export function validateWhatsAppMessageRequest(
	data: unknown
): ValidationResult<WhatsAppSendMessageRequest> {
	const isValid = validateWhatsAppMessage(data)
	return {
		isValid,
		data: isValid ? (data as WhatsAppSendMessageRequest) : undefined,
		errors: isValid
			? undefined
			: formatAjvErrors(validateWhatsAppMessage.errors || []),
	}
}

/** Validate WhatsApp typing request */
export function validateWhatsAppTypingRequest(
	data: unknown
): ValidationResult<WhatsAppTypingRequest> {
	const isValid = validateWhatsAppTyping(data)
	return {
		isValid,
		data: isValid ? (data as WhatsAppTypingRequest) : undefined,
		errors: isValid
			? undefined
			: formatAjvErrors(validateWhatsAppTyping.errors || []),
	}
}

/** Validate template */
export function validateTemplateData(
	data: unknown
): ValidationResult<Template> {
	const isValid = validateTemplate(data)
	return {
		isValid,
		data: isValid ? (data as Template) : undefined,
		errors: isValid
			? undefined
			: formatAjvErrors(validateTemplate.errors || []),
	}
}

/** Generic validation function for any schema */
export function createValidator<T>(schema: Schema) {
	const validate = ajv.compile<T>(schema)
	return (data: unknown): ValidationResult<T> => {
		const isValid = validate(data)
		return {
			isValid,
			data: isValid ? (data as T) : undefined,
			errors: isValid ? undefined : formatAjvErrors(validate.errors || []),
		}
	}
}

/** Format validation errors for API response */
export function formatValidationErrorForAPI(errors: ValidationError[]): string {
	if (errors.length === 1) {
		return `${errors[0].path === 'root' ? '' : `${errors[0].path}: `}${errors[0].message}`
	}

	return `Multiple validation errors: ${errors
		.map((e) => `${e.path === 'root' ? '' : `${e.path}: `}${e.message}`)
		.join(', ')}`
}

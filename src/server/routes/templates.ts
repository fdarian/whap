import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { templateStore } from '../store/template-store.ts'
import type {
	CreateTemplateRequest,
	UpdateTemplateRequest,
	WhatsAppErrorResponse,
} from '../types/api-types.ts'
import {
	formatValidationErrorForAPI,
	validateTemplateData,
	validateTemplateUpdateData,
} from '../utils/validator.ts'
const templatesRouter = new Hono()

/** Validation middleware for template creation */
const validateTemplate = validator('json', (value, c) => {
	const result = validateTemplateData(value)
	if (result.isValid && result.data) {
		return result.data
	}

	const errorMessage = formatValidationErrorForAPI(
		result.errors || [{ path: 'root', message: 'Invalid template format' }]
	)

	return c.json(
		{
			error: {
				message: errorMessage,
				type: 'validation_error',
				code: 400,
			},
		} as WhatsAppErrorResponse,
		400
	)
})

/** Validation middleware for template updates */
const validateTemplateUpdate = validator('json', (value, c) => {
	const result = validateTemplateUpdateData(value)
	if (result.isValid && result.data) {
		return result.data
	}
	const errorMessage = formatValidationErrorForAPI(
		result.errors || [{ path: 'root', message: 'Invalid update format' }]
	)
	return c.json(
		{
			error: {
				message: errorMessage,
				type: 'validation_error',
				code: 400,
			},
		} as WhatsAppErrorResponse,
		400
	)
})

// GET /v22.0/{business-account-id}/message_templates - List all templates
templatesRouter.get('/:businessAccountId/message_templates', (c) => {
	const { businessAccountId } = c.req.param()
	const templates = templateStore.getAllTemplates()

	return c.json({
		data: templates.map((template) => ({
			name: template.name,
			language: template.language,
			category: template.category,
			components: template.components,
			...(template.variables && { variables: template.variables }),
		})),
		paging: {
			cursors: {
				before: '',
				after: '',
			},
		},
	})
})

// POST /v22.0/{business-account-id}/message_templates - Create new template
templatesRouter.post(
	'/:businessAccountId/message_templates',
	validateTemplate,
	async (c) => {
		const templateData = c.req.valid('json') as CreateTemplateRequest

		// Check if template already exists
		const existingTemplate = templateStore.getTemplate(
			templateData.name,
			templateData.language
		)
		if (existingTemplate) {
			return c.json(
				{
					error: {
						message: `Template '${templateData.name}' with language '${templateData.language}' already exists.`,
						type: 'duplicate_template',
						code: 132001,
					},
				} as WhatsAppErrorResponse,
				409
			)
		}

		// Add template to the store
		await templateStore.addTemplate(templateData)

		return c.json(
			{
				id: `${templateData.name}_${templateData.language}`,
				status: 'PENDING',
				category: templateData.category,
			},
			201
		)
	}
)

// GET /v22.0/{business-account-id}/message_templates/{template-name} - Get specific template
templatesRouter.get(
	'/:businessAccountId/message_templates/:templateName',
	(c) => {
		const { businessAccountId, templateName } = c.req.param()
		const language = c.req.query('language') || 'en'

		const template = templateStore.getTemplate(templateName, language)
		if (!template) {
			return c.json(
				{
					error: {
						message: `Template '${templateName}' not found for language '${language}'`,
						type: 'template_not_found',
						code: 404,
					},
				} as WhatsAppErrorResponse,
				404
			)
		}

		return c.json({
			name: template.name,
			language: template.language,
			category: template.category,
			components: template.components,
			...(template.variables && { variables: template.variables }),
		})
	}
)

// POST /v22.0/{business-account-id}/message_templates/{template-name} - Update template
templatesRouter.post(
	'/:businessAccountId/message_templates/:templateName',
	validateTemplateUpdate,
	async (c) => {
		const { templateName } = c.req.param()
		const updateData = c.req.valid('json') as UpdateTemplateRequest

		// For updates, the language might be in the query or body, let's prioritize query
		const language = c.req.query('language') || 'en_US' // Default or common language

		// Check if template exists
		const existingTemplate = templateStore.getTemplate(templateName, language)
		if (!existingTemplate) {
			return c.json(
				{
					error: {
						message: `Template '${templateName}' not found for language '${language}'`,
						type: 'template_not_found',
						code: 404,
					},
				} as WhatsAppErrorResponse,
				404
			)
		}

		// Update the template
		await templateStore.updateTemplate(templateName, language, updateData)

		return c.json({
			success: true,
			id: `${templateName}_${language}`,
		})
	}
)

// DELETE /v22.0/{business-account-id}/message_templates/{template-name} - Delete template
templatesRouter.delete(
	'/:businessAccountId/message_templates/:templateName',
	async (c) => {
		const { templateName } = c.req.param()
		const language = c.req.query('language')

		if (!language) {
			return c.json(
				{
					error: {
						message: 'Language query parameter is required for deletion.',
						type: 'validation_error',
						code: 400,
					},
				} as WhatsAppErrorResponse,
				400
			)
		}

		const success = await templateStore.deleteTemplate(templateName, language)

		if (!success) {
			return c.json(
				{
					error: {
						message: `Template '${templateName}' not found for language '${language}'`,
						type: 'template_not_found',
						code: 404,
					},
				} as WhatsAppErrorResponse,
				404
			)
		}

		return c.json({
			success: true,
		})
	}
)

export { templatesRouter }

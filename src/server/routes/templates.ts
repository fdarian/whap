import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { templateStore } from '../store/template-store.ts'
import type { Template } from '../store/template-store.ts'
import type { WhatsAppErrorResponse } from '../types/api-types.ts'
import {
	formatValidationErrorForAPI,
	validateTemplateData,
} from '../utils/validator.ts'

const templatesRouter = new Hono()

/** Validation middleware for template requests */
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
	(c) => {
		const { businessAccountId } = c.req.param()
		const templateData = c.req.valid('json') as Template

		// Check if template already exists
		const existingTemplate = templateStore.getTemplate(
			templateData.name,
			templateData.language
		)
		if (existingTemplate) {
			return c.json(
				{
					error: {
						message: `Template '${templateData.name}' already exists for language '${templateData.language}'`,
						type: 'duplicate_template',
						code: 409,
					},
				} as WhatsAppErrorResponse,
				409
			)
		}

		// For this mock implementation, we'll simulate storing the template
		// In a real implementation, this would create a file or save to database
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
	validateTemplate,
	(c) => {
		const { businessAccountId, templateName } = c.req.param()
		const templateData = c.req.valid('json') as Template

		// Check if template exists
		const existingTemplate = templateStore.getTemplate(
			templateName,
			templateData.language
		)
		if (!existingTemplate) {
			return c.json(
				{
					error: {
						message: `Template '${templateName}' not found for language '${templateData.language}'`,
						type: 'template_not_found',
						code: 404,
					},
				} as WhatsAppErrorResponse,
				404
			)
		}

		// For this mock implementation, we'll simulate updating the template
		return c.json({
			success: true,
			id: `${templateName}_${templateData.language}`,
		})
	}
)

// DELETE /v22.0/{business-account-id}/message_templates/{template-name} - Delete template
templatesRouter.delete(
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

		// For this mock implementation, we'll simulate deleting the template
		return c.json({
			success: true,
		})
	}
)

export { templatesRouter }

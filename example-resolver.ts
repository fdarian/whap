#!/usr/bin/env bun

// Example template resolver script for whap
// Usage: bun run example-resolver.ts [template_name] --lang [language]

const name = process.argv[2]
const langIndex = process.argv.indexOf('--lang')
const language = langIndex > -1 ? process.argv[langIndex + 1] : 'en'

// Example: Return different templates based on name and language
const templates: Record<string, any> = {
	welcome: {
		en: {
			name: 'welcome',
			language: 'en',
			category: 'UTILITY',
			components: [
				{
					type: 'HEADER',
					format: 'TEXT',
					text: 'Welcome!',
				},
				{
					type: 'BODY',
					text: 'Hello {{1}}! Welcome to our service.',
				},
			],
			variables: {
				'1': {
					description: 'User name',
					example: 'John',
				},
			},
		},
		es: {
			name: 'welcome',
			language: 'es',
			category: 'UTILITY',
			components: [
				{
					type: 'HEADER',
					format: 'TEXT',
					text: '¡Bienvenido!',
				},
				{
					type: 'BODY',
					text: 'Hola {{1}}! Bienvenido a nuestro servicio.',
				},
			],
			variables: {
				'1': {
					description: 'Nombre de usuario',
					example: 'Juan',
				},
			},
		},
	},
	notification: {
		en: {
			name: 'notification',
			language: 'en',
			category: 'MARKETING',
			components: [
				{
					type: 'BODY',
					text: 'You have a new notification: {{1}}',
				},
			],
			variables: {
				'1': {
					description: 'Notification message',
					example: 'Your order has been shipped',
				},
			},
		},
	},
}

// Get the template
const template = templates[name]?.[language] || templates[name]?.['en']

if (template) {
	console.log(JSON.stringify(template))
} else {
	// Return empty result if template not found
	// The TemplateResolver will handle this as null
	process.exit(1)
}

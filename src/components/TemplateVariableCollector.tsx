import { Box, Text, useInput } from 'ink'
import { type FC, useEffect, useState } from 'react'
import type { Template } from '../utils/api-client.ts'
import { TextInput } from './TextInput.tsx'

interface TemplateVariableCollectorProps {
	template: Template
	onComplete: (parameters: Record<string, string>) => void
	onCancel: () => void
}

interface VariableInfo {
	key: string
	description: string
	example: string
	required: boolean
	type: 'text' | 'number' | 'email' | 'date'
}

/** Extract variable placeholders from template text */
const extractTemplateVariables = (template: Template): VariableInfo[] => {
	const variablePlaceholders = new Set<string>()

	// Extract {{n}} placeholders from all text fields
	const extractFromText = (text: string) => {
		const matches = text.match(/\{\{(\d+)\}\}/g)
		if (matches) {
			for (const match of matches) {
				variablePlaceholders.add(match.replace(/[{}]/g, ''))
			}
		}
	}

	// Check all components for variables
	for (const component of template.components) {
		if (component.text) {
			extractFromText(component.text)
		}
		if (component.buttons) {
			for (const button of component.buttons) {
				if (button.text) extractFromText(button.text)
				if (button.url) extractFromText(button.url)
			}
		}
	}

	// Convert to VariableInfo array, prioritizing template.variables metadata
	return Array.from(variablePlaceholders)
		.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
		.map((key) => {
			const metadata = template.variables?.[key]
			return {
				key,
				description: metadata?.description || `Variable ${key}`,
				example: metadata?.example || 'Enter value',
				required: true, // Default to required for now
				type: inferVariableType(
					metadata?.description || '',
					metadata?.example || ''
				),
			}
		})
}

/** Infer variable type from description and example */
const inferVariableType = (
	description: string,
	example: string
): VariableInfo['type'] => {
	const desc = description.toLowerCase()
	const ex = example.toLowerCase()

	if (desc.includes('email') || ex.includes('@')) return 'email'
	if (
		desc.includes('number') ||
		desc.includes('amount') ||
		/^\d+$/.test(example)
	)
		return 'number'
	if (desc.includes('date') || desc.includes('time')) return 'date'

	return 'text'
}

/** Validate parameter value based on type */
const validateParameter = (
	value: string,
	type: VariableInfo['type']
): string | null => {
	if (!value.trim()) return 'This field is required'

	switch (type) {
		case 'email': {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
			return emailRegex.test(value)
				? null
				: 'Please enter a valid email address'
		}
		case 'number':
			return Number.isNaN(Number(value)) ? 'Please enter a valid number' : null
		case 'date':
			return Number.isNaN(Date.parse(value))
				? 'Please enter a valid date'
				: null
		default:
			return null
	}
}

export const TemplateVariableCollector: FC<TemplateVariableCollectorProps> = ({
	template,
	onComplete,
	onCancel,
}) => {
	const [variables] = useState<VariableInfo[]>(() =>
		extractTemplateVariables(template)
	)
	const [currentIndex, setCurrentIndex] = useState(0)
	const [parameters, setParameters] = useState<Record<string, string>>({})
	const [currentValue, setCurrentValue] = useState('')
	const [validationError, setValidationError] = useState<string | null>(null)
	const [showPreview, setShowPreview] = useState(false)

	const currentVariable = variables[currentIndex]
	const isComplete = currentIndex >= variables.length

	useInput((input, key) => {
		if (key.escape) {
			onCancel()
			return
		}

		if (key.return) {
			if (isComplete) {
				// Send template
				onComplete(parameters)
				return
			}

			// Validate current parameter
			const error = validateParameter(currentValue, currentVariable.type)
			if (error) {
				setValidationError(error)
				return
			}

			// Save parameter and move to next
			setParameters((prev) => ({
				...prev,
				[currentVariable.key]: currentValue.trim(),
			}))
			setCurrentValue('')
			setValidationError(null)
			setCurrentIndex((prev) => prev + 1)
			return
		}

		if (key.ctrl && input === 'p') {
			setShowPreview(!showPreview)
			return
		}

		if (key.ctrl && input === 'b' && currentIndex > 0) {
			// Go back to previous parameter
			const prevVariable = variables[currentIndex - 1]
			setCurrentValue(parameters[prevVariable.key] || '')
			setCurrentIndex((prev) => prev - 1)
			setValidationError(null)
			return
		}
	})

	// Clear validation error when user types
	useEffect(() => {
		if (validationError && currentValue) {
			setValidationError(null)
		}
	}, [currentValue, validationError])

	const renderTemplatePreview = () => {
		if (!showPreview) return null

		// Create preview text by replacing variables
		let previewText = ''
		for (const component of template.components) {
			if (component.text) {
				let text = component.text
				for (const [key, value] of Object.entries(parameters)) {
					text = text.replace(
						new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
						value || `{{${key}}}`
					)
				}
				previewText = `${previewText}${text}\n`
			}
		}

		return (
			<Box
				flexDirection="column"
				marginBottom={2}
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
			>
				<Box marginBottom={1}>
					<Text color="cyan">📋 Template Preview:</Text>
				</Box>
				<Text color="white" wrap="wrap">
					{previewText.trim()}
				</Text>
			</Box>
		)
	}

	if (isComplete) {
		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Text color="green">✅ All parameters collected!</Text>
				</Box>

				<Box marginBottom={1}>
					<Text color="cyan">Template: {template.name}</Text>
				</Box>

				{renderTemplatePreview()}

				<Box marginBottom={1} flexDirection="column">
					<Text color="yellow">Parameters:</Text>
					{Object.entries(parameters).map(([key, value]) => (
						<Text key={key} color="white">
							{' '}
							{key}: "{value}"
						</Text>
					))}
				</Box>

				<Box marginTop={1}>
					<Text color="gray" dimColor>
						Enter: Send template | Esc: Cancel | Ctrl+P: Toggle preview
					</Text>
				</Box>
			</Box>
		)
	}

	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<Text color="cyan">📝 Template: {template.name}</Text>
			</Box>

			<Box marginBottom={1}>
				<Text color="yellow">
					Parameter {currentVariable.key} ({currentIndex + 1} of{' '}
					{variables.length}):
				</Text>
			</Box>

			<Box marginBottom={1} flexDirection="column">
				<Text color="gray" dimColor>
					{currentVariable.description}
				</Text>
				<Text color="gray" dimColor>
					Example: {currentVariable.example}
				</Text>
				{currentVariable.type !== 'text' && (
					<Text color="gray" dimColor>
						Type: {currentVariable.type}
					</Text>
				)}
			</Box>

			{renderTemplatePreview()}

			<Box marginBottom={1}>
				<TextInput
					value={currentValue}
					onChange={setCurrentValue}
					placeholder={`Enter ${currentVariable.type === 'text' ? 'value' : currentVariable.type} for ${currentVariable.key}...`}
					focus={true}
				/>
			</Box>

			{validationError && (
				<Box marginBottom={1}>
					<Text color="red">❌ {validationError}</Text>
				</Box>
			)}

			<Box marginTop={1}>
				<Text color="gray" dimColor>
					Enter: Next parameter | Esc: Cancel | Ctrl+B: Back | Ctrl+P: Preview
				</Text>
			</Box>

			{/* Progress indicator */}
			<Box marginTop={1}>
				<Text color="gray" dimColor>
					Progress: {currentIndex + 1}/{variables.length} parameters
				</Text>
			</Box>
		</Box>
	)
}

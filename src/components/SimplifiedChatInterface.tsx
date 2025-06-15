import { format } from 'date-fns'
import { Box, Text, useInput } from 'ink'
import { type FC, useCallback, useEffect, useState } from 'react'
import type { ApiClient, Message, Template } from '../utils/api-client.ts'
import { useTerminal } from '../utils/terminal.ts'
import { webSocketClient } from '../utils/websocket-client.ts'
import { TemplateVariableCollector } from './TemplateVariableCollector.tsx'
import { TextInput } from './TextInput.tsx'

interface SimplifiedChatInterfaceProps {
	apiClient: ApiClient
	userPhoneNumber?: string
	botPhoneNumber?: string
	onSetupComplete: (userNumber: string, botNumber: string) => void
	onNewConversation: () => void
	isConnected: boolean
}

type InterfaceMode = 'chat' | 'templates' | 'template-params'
type SetupStage = 'user-phone' | 'bot-phone' | 'complete'

export const SimplifiedChatInterface: FC<SimplifiedChatInterfaceProps> = ({
	apiClient,
	userPhoneNumber,
	botPhoneNumber,
	onSetupComplete,
	onNewConversation,
	isConnected,
}) => {
	const [messages, setMessages] = useState<Message[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string>('')
	const [currentMessage, setCurrentMessage] = useState('')
	const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
		'idle'
	)
	const [errorMessage, setErrorMessage] = useState('')
	const [isAgentTyping, setIsAgentTyping] = useState(false)

	// Template-related state
	const [mode, setMode] = useState<InterfaceMode>('chat')
	const [templates, setTemplates] = useState<Template[]>([])
	const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0)
	const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
		null
	)
	const [templateParams, setTemplateParams] = useState<Record<string, string>>(
		{}
	)
	const [templatesLoading, setTemplatesLoading] = useState(false)
	const [showCommandPalette, setShowCommandPalette] = useState(false)

	// Setup-related state for progressive prompts
	const [setupStage, setSetupStage] = useState<SetupStage>(
		userPhoneNumber && botPhoneNumber ? 'complete' : 'user-phone'
	)
	const [tempUserPhone, setTempUserPhone] = useState('')
	const [tempBotPhone, setTempBotPhone] = useState('')
	const [systemMessages, setSystemMessages] = useState<
		Array<{
			id: string
			text: string
			timestamp: Date
			type: 'system'
		}>
	>([])

	const terminal = useTerminal()

	// Validation functions for setup
	const validateUserPhoneNumber = (phone: string): boolean => {
		// Indonesian phone number format: starts with 62, followed by 8-12 digits
		const phoneRegex = /^62\d{8,12}$/
		return phoneRegex.test(phone.trim())
	}

	const validateBotPhoneNumberId = (phoneId: string): boolean => {
		// Check if input contains only numbers
		return /^\d+$/.test(phoneId.trim())
	}

	const addSystemMessage = useCallback((text: string) => {
		const systemMessage = {
			id: Date.now().toString(),
			text,
			timestamp: new Date(),
			type: 'system' as const,
		}
		setSystemMessages((prev) => [...prev, systemMessage])
	}, [])

	// Initialize system messages on setup start
	useEffect(() => {
		if (setupStage === 'user-phone' && systemMessages.length === 0) {
			addSystemMessage(
				'WhatsApp CLI started. Type /help for available commands.'
			)
			addSystemMessage(
				"Let's get you set up. What's your phone number? (Indonesian format, e.g. 6281234567890)"
			)
		}
	}, [setupStage, systemMessages.length, addSystemMessage])

	// No message limits - show full conversation history

	const loadConversation = useCallback(async () => {
		if (!userPhoneNumber || !botPhoneNumber) return

		setLoading(true)
		setError('')

		try {
			const history = await apiClient.getConversationHistory(
				userPhoneNumber,
				botPhoneNumber
			)
			setMessages(history.messages)
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to load conversation'
			)
		} finally {
			setLoading(false)
		}
	}, [apiClient, userPhoneNumber, botPhoneNumber])

	useEffect(() => {
		loadConversation()

		const handleWebSocketMessage = (message: {
			type: string
			payload: unknown
		}) => {
			if (message.type === 'NEW_MESSAGE') {
				loadConversation()
				setIsAgentTyping(false)
			} else if (message.type === 'TYPING_INDICATOR') {
				const payload = message.payload as {
					phoneNumberId: string
					messageId: string
					isTyping: boolean
					timestamp: number
				}
				// Show typing indicator when the agent (bot) is typing to the user
				if (payload.phoneNumberId === botPhoneNumber) {
					setIsAgentTyping(payload.isTyping)
				}
			}
		}

		webSocketClient.addMessageListener(handleWebSocketMessage)

		return () => {
			webSocketClient.removeMessageListener(handleWebSocketMessage)
		}
	}, [loadConversation, botPhoneNumber])

	useInput((input, key) => {
		if (mode === 'chat') {
			if (key.return && currentMessage.trim()) {
				// Handle setup stages
				if (setupStage === 'user-phone') {
					void handleUserPhoneInput(currentMessage)
					return
				}
				if (setupStage === 'bot-phone') {
					void handleBotPhoneInput(currentMessage)
					return
				}

				// Normal chat mode
				if (currentMessage.startsWith('/')) {
					void handleSlashCommand(currentMessage)
				} else {
					void handleSendMessage() // fire-and-forget
				}
				return
			}

			if (key.ctrl && input === 'r') {
				loadConversation()
			}

			if (key.ctrl && input === 'n') {
				onNewConversation()
			}

			if (key.ctrl && input === 't') {
				void handleTemplateMode()
			}
		} else if (mode === 'templates') {
			if (key.upArrow && selectedTemplateIndex > 0) {
				setSelectedTemplateIndex(selectedTemplateIndex - 1)
			}

			if (key.downArrow && selectedTemplateIndex < templates.length - 1) {
				setSelectedTemplateIndex(selectedTemplateIndex + 1)
			}

			if (key.return && templates[selectedTemplateIndex]) {
				handleSelectTemplate(templates[selectedTemplateIndex])
			}

			if (key.escape) {
				setMode('chat')
			}
		} else if (mode === 'template-params') {
			// Template parameter input is now handled by TemplateVariableCollector
			// No additional input handling needed here
		}
	})

	const handleUserPhoneInput = async (phoneNumber: string) => {
		// Add user input to system messages
		const userMessage = {
			id: Date.now().toString(),
			text: phoneNumber,
			timestamp: new Date(),
			type: 'user' as const,
		}
		setSystemMessages((prev) => [...prev, { ...userMessage, type: 'system' }])
		setCurrentMessage('')

		if (!validateUserPhoneNumber(phoneNumber)) {
			addSystemMessage(
				'Invalid format. Please use Indonesian format (62xxxxxxxxxx)'
			)
			return
		}

		setTempUserPhone(phoneNumber.trim())
		addSystemMessage("Great! What's your bot's phone number ID?")
		setSetupStage('bot-phone')
	}

	const handleBotPhoneInput = async (phoneId: string) => {
		// Add user input to system messages
		const userMessage = {
			id: Date.now().toString(),
			text: phoneId,
			timestamp: new Date(),
			type: 'user' as const,
		}
		setSystemMessages((prev) => [...prev, { ...userMessage, type: 'system' }])
		setCurrentMessage('')

		if (!validateBotPhoneNumberId(phoneId)) {
			addSystemMessage(
				'Invalid phone number ID format. Use format: 6286777363432'
			)
			return
		}

		setTempBotPhone(phoneId.trim())
		addSystemMessage('✓ Connected! You can now start sending messages.')
		setSetupStage('complete')
		onSetupComplete(tempUserPhone, phoneId.trim())
	}

	const handleTemplateMode = async () => {
		setMode('templates')
		setTemplatesLoading(true)
		try {
			const fetchedTemplates = await apiClient.getTemplates()
			setTemplates(fetchedTemplates)
			setSelectedTemplateIndex(0)
		} catch (error) {
			setError('Failed to load templates')
		} finally {
			setTemplatesLoading(false)
		}
	}

	const handleSelectTemplate = (template: Template) => {
		setSelectedTemplate(template)
		setTemplateParams({})

		if (template.variables && Object.keys(template.variables).length > 0) {
			// Template has parameters, switch to parameter input mode
			setMode('template-params')
		} else {
			// No parameters needed, send immediately using new handler
			void handleTemplateVariablesComplete({})
		}
	}

	const handleSendMessage = async () => {
		if (!currentMessage.trim() || !userPhoneNumber || !botPhoneNumber) return

		setStatus('sending')
		setErrorMessage('')

		try {
			await apiClient.sendMessage(
				userPhoneNumber,
				botPhoneNumber,
				currentMessage
			)
			setStatus('sent')
			setCurrentMessage('')

			// Reload conversation to show the new message
			await loadConversation()

			// Clear status after 2 seconds
			setTimeout(() => {
				setStatus('idle')
			}, 2000)
		} catch (error) {
			setStatus('error')
			setErrorMessage(
				error instanceof Error ? error.message : 'Failed to send message'
			)
		}
	}

	const renderMessage = (
		message:
			| Message
			| { id: string; text: string; timestamp: Date; type: 'system' }
	) => {
		// Use local timezone
		const now = new Date()
		const msgDate = new Date(message.timestamp)
		const isToday =
			msgDate.getDate() === now.getDate() &&
			msgDate.getMonth() === now.getMonth() &&
			msgDate.getFullYear() === now.getFullYear()

		const timestamp = isToday
			? format(msgDate, 'HH:mm:ss')
			: format(msgDate, 'MM/dd HH:mm')

		// Handle system messages differently
		if ('type' in message && message.type === 'system') {
			const header = `${timestamp} System`
			const indentation = '  ' // 2 spaces for indentation
			return (
				<Text key={message.id} color="gray" wrap="wrap">
					<Text color="gray" dimColor>
						{header}
					</Text>
					{`\n${indentation}${message.text}\n`}
				</Text>
			)
		}

		// Handle regular chat messages
		const isOutgoing = (message as Message).direction === 'sent'
		const messageText = (message as Message).text?.trim() || '(empty)'

		// Simplified single-line format for outgoing/incoming
		const prefix = isOutgoing ? 'You' : 'Bot'
		const header = `${timestamp} ${prefix}`
		const indentation = '  ' // 2 spaces for indentation

		// Just render as text - let terminal handle flow naturally
		return (
			<Text key={message.id} color={isOutgoing ? 'cyan' : 'green'} wrap="wrap">
				<Text color="gray" dimColor>
					{header}
				</Text>
				{`\n${indentation}${messageText}\n`}
			</Text>
		)
	}

	const renderStatusIndicator = () => {
		switch (status) {
			case 'sending':
				return <Text color="yellow">Sending...</Text>
			case 'sent':
				return <Text color="green">✓ Sent</Text>
			case 'error':
				return <Text color="red">✗ {errorMessage}</Text>
			default:
				return null
		}
	}

	const renderTemplateSelector = () => {
		if (templatesLoading) {
			return (
				<Box justifyContent="center" paddingY={2}>
					<Text color="yellow">Loading templates...</Text>
				</Box>
			)
		}

		if (templates.length === 0) {
			return (
				<Box justifyContent="center" paddingY={2}>
					<Text color="red">No templates available</Text>
				</Box>
			)
		}

		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Text color="cyan">
						📋 Select a Template ({templates.length} available):
					</Text>
				</Box>

				{templates.map((template, index) => (
					<Box key={`${template.name}_${template.language}`} marginBottom={1}>
						<Text
							color={index === selectedTemplateIndex ? 'cyan' : 'white'}
							backgroundColor={
								index === selectedTemplateIndex ? 'blue' : undefined
							}
						>
							{index === selectedTemplateIndex ? '▶ ' : '  '}
							{template.name} ({template.category})
						</Text>
					</Box>
				))}

				<Box marginTop={1}>
					<Text color="gray" dimColor>
						↑/↓: Navigate | Enter: Select | Esc: Back to chat
					</Text>
				</Box>
			</Box>
		)
	}

	const handleTemplateVariablesComplete = async (
		parameters: Record<string, string>
	) => {
		if (!selectedTemplate || !userPhoneNumber || !botPhoneNumber) return

		setStatus('sending')
		setErrorMessage('')

		try {
			const parameterArray = Object.entries(parameters)
				.sort(([a], [b]) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
				.map(([, value]) => value)

			await apiClient.sendTemplateMessage(
				userPhoneNumber,
				botPhoneNumber,
				selectedTemplate.name,
				parameterArray
			)

			setStatus('sent')
			setMode('chat')
			setSelectedTemplate(null)
			setTemplateParams({})

			// Reload conversation to show the new message
			await loadConversation()

			// Clear status after 2 seconds
			setTimeout(() => {
				setStatus('idle')
			}, 2000)
		} catch (error) {
			setStatus('error')
			setErrorMessage(
				error instanceof Error ? error.message : 'Failed to send template'
			)
		}
	}

	const handleTemplateVariablesCancel = () => {
		setMode('templates')
		setSelectedTemplate(null)
		setTemplateParams({})
	}

	const handleSlashCommand = async (command: string) => {
		const cmd = command.toLowerCase().trim()
		setCurrentMessage('')
		setShowCommandPalette(false)

		switch (cmd) {
			case '/help':
				// Add help message to conversation
				break
			case '/new':
				onNewConversation()
				break
			case '/refresh':
				loadConversation()
				break
			case '/file':
				// Handle file upload
				break
			default:
				// Unknown command - could add to conversation as system message
				break
		}
	}

	// Monitor message input for slash commands
	const handleMessageChange = (value: string) => {
		setCurrentMessage(value)
		setShowCommandPalette(value === '/' || value.startsWith('/'))
	}

	// Get context-aware placeholder text
	const getPlaceholderText = () => {
		switch (setupStage) {
			case 'user-phone':
				return 'Enter your phone number (e.g., 6286777363432)'
			case 'bot-phone':
				return 'Enter bot phone number ID (e.g., 6286777363433)'
			case 'complete':
				return 'Type your message...'
			default:
				return 'Type your message...'
		}
	}

	return (
		<Box flexDirection="column">
			{/* Conversation area - let content flow naturally */}
			<Box flexDirection="column" paddingX={2}>
				{mode === 'templates' && renderTemplateSelector()}
				{mode === 'template-params' && selectedTemplate && (
					<TemplateVariableCollector
						template={selectedTemplate}
						onComplete={handleTemplateVariablesComplete}
						onCancel={handleTemplateVariablesCancel}
					/>
				)}

				{mode === 'chat' && (
					<>
						{loading && <Text color="yellow">Loading conversation...</Text>}

						{error && <Text color="red">Error: {error}</Text>}

						{/* System messages first, then regular messages in chronological order */}
						{systemMessages.map(renderMessage)}
						{setupStage === 'complete' &&
							messages
								.slice()
								.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) // Chronological order - oldest first, newest at bottom
								.map(renderMessage)}

						{/* Typing indicator at bottom */}
						{isAgentTyping && (
							<Text color="green" dimColor>
								🤖 Bot is typing...
							</Text>
						)}
					</>
				)}
			</Box>

			{/* Input area - minimal structure */}
			{mode === 'chat' && (
				<>
					<Box borderStyle="single" borderColor="gray" paddingX={1}>
						<TextInput
							value={currentMessage}
							onChange={handleMessageChange}
							placeholder={getPlaceholderText()}
							focus={true}
						/>
					</Box>

					{/* Command palette - appears below input when typing slash commands (only in complete setup) */}
					{showCommandPalette && setupStage === 'complete' && (
						<>
							<Text color="gray" dimColor>
								/help Show available commands
							</Text>
							<Text color="gray" dimColor>
								/new Start new conversation
							</Text>
							<Text color="gray" dimColor>
								/refresh Reload conversation history
							</Text>
							<Text color="gray" dimColor>
								/file Upload file to bot
							</Text>
						</>
					)}

					{/* Status indicator - bottom right aligned */}
					{userPhoneNumber && botPhoneNumber && (
						<Text color="gray" dimColor>
							{userPhoneNumber.slice(-4)}...→{botPhoneNumber.slice(-4)}... ●
						</Text>
					)}
				</>
			)}
		</Box>
	)
}

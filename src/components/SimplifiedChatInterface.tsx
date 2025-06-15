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
	userPhoneNumber: string
	botPhoneNumber: string
	onNewConversation: () => void
	isConnected: boolean
}

type InterfaceMode = 'chat' | 'templates' | 'template-params'

export const SimplifiedChatInterface: FC<SimplifiedChatInterfaceProps> = ({
	apiClient,
	userPhoneNumber,
	botPhoneNumber,
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

	const terminal = useTerminal()

	// No message limits - show full conversation history

	const loadConversation = useCallback(async () => {
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
		if (!currentMessage.trim()) return

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

	const renderMessage = (message: Message) => {
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

		const isOutgoing = message.direction === 'sent'
		const messageText = message.text?.trim() || '(empty)'

		// Simplified single-line format for outgoing/incoming
		const prefix = isOutgoing ? 'You' : 'Bot'
		const header = `${timestamp} ${prefix}`
		const indentation = '  ' // 2 spaces for indentation

		// By combining into a single Text component with explicit newlines and indentation,
		// we give Ink's wrapping algorithm the best chance to work correctly.
		return (
			<Box key={message.id} marginBottom={1}>
				<Text color={isOutgoing ? 'cyan' : 'green'} wrap="wrap">
					<Text color="gray" dimColor>
						{header}
					</Text>
					{`\n${indentation}${messageText}`}
				</Text>
			</Box>
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
		if (!selectedTemplate) return

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

	return (
		<Box flexDirection="column" height="100%">
			{/* Conversation area - no borders, clean scrolling */}
			<Box flexDirection="column" flexGrow={1} paddingX={2}>
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
						{loading && (
							<Box justifyContent="center" paddingY={2}>
								<Text color="yellow">Loading conversation...</Text>
							</Box>
						)}

						{error && (
							<Box justifyContent="center" paddingY={2}>
								<Text color="red">Error: {error}</Text>
							</Box>
						)}

						{/* Empty conversation state - no special content, just typing indicator */}
						{!loading && messages.length === 0 && isAgentTyping && (
							<Box marginBottom={1}>
								<Text color="green" dimColor>
									🤖 Bot is typing...
								</Text>
							</Box>
						)}

						{messages.length > 0 && (
							<>
								{messages
									.slice()
									.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) // Chronological order - oldest first, newest at bottom
									.map(renderMessage)}

								{/* Typing indicator at bottom */}
								{isAgentTyping && (
									<Box marginBottom={1}>
										<Text color="green" dimColor>
											🤖 Bot is typing...
										</Text>
									</Box>
								)}
							</>
						)}
					</>
				)}
			</Box>

			{/* Input area at bottom */}
			{mode === 'chat' && (
				<>
					<Box
						flexDirection="column"
						borderStyle="single"
						borderColor="gray"
						paddingX={2}
						paddingY={1}
					>
						<TextInput
							value={currentMessage}
							onChange={handleMessageChange}
							placeholder="Type your message..."
							focus={true}
						/>
					</Box>

					{/* Command palette - appears below input when typing slash commands */}
					{showCommandPalette && (
						<Box flexDirection="column" paddingX={2}>
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
						</Box>
					)}

					{/* Status indicator - outside input box, bottom right */}
					<Box justifyContent="flex-end" paddingX={2}>
						<Text color="gray" dimColor>
							{userPhoneNumber.slice(-4)}...→{botPhoneNumber.slice(-4)}... ●
						</Text>
					</Box>
				</>
			)}
		</Box>
	)
}

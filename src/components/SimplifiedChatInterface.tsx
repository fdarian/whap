import { format } from 'date-fns'
import { Box, Text, useInput } from 'ink'
import { type FC, useCallback, useEffect, useState } from 'react'
import type { ApiClient, Message } from '../utils/api-client.ts'
import { useTerminal } from '../utils/terminal.ts'
import { webSocketClient } from '../utils/websocket-client.ts'
import { TextInput } from './TextInput.tsx'

interface SimplifiedChatInterfaceProps {
	apiClient: ApiClient
	userPhoneNumber?: string
	botPhoneNumber?: string
	onSetupComplete: (userNumber: string, botNumber: string) => void
	onNewConversation: () => void
	isConnected: boolean
}

type SetupStage = 'user-phone' | 'bot-phone' | 'complete'
type FileUploadStage = 'path' | 'caption' | 'uploading' | 'idle'

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

	const [showCommandPalette, setShowCommandPalette] = useState(false)

	// Setup-related state for progressive prompts
	const [setupStage, setSetupStage] = useState<SetupStage>(
		userPhoneNumber && botPhoneNumber ? 'complete' : 'user-phone'
	)
	const [tempUserPhone, setTempUserPhone] = useState('')
	const [tempBotPhone, setTempBotPhone] = useState('')

	// File upload state for progressive prompts
	const [fileUploadStage, setFileUploadStage] =
		useState<FileUploadStage>('idle')
	const [tempFilePath, setTempFilePath] = useState('')
	const [tempFileCaption, setTempFileCaption] = useState('')
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
			id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

			// Handle file upload stages
			if (fileUploadStage === 'path') {
				void handleFilePathInput(currentMessage)
				return
			}
			if (fileUploadStage === 'caption') {
				void handleFileCaptionInput(currentMessage)
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

		// Escape key to cancel file upload
		if (key.escape && fileUploadStage !== 'idle') {
			addSystemMessage('❌ File upload cancelled.')
			setFileUploadStage('idle')
			setTempFilePath('')
			setTempFileCaption('')
			setCurrentMessage('')
		}
	})

	const handleUserPhoneInput = async (phoneNumber: string) => {
		// Add user input to system messages
		const userMessage = {
			id: `user-input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
			id: `bot-input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

	const handleFilePathInput = async (filePath: string) => {
		// Add user input to system messages
		const userMessage = {
			id: `file-path-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			text: filePath,
			timestamp: new Date(),
			type: 'user' as const,
		}
		setSystemMessages((prev) => [...prev, { ...userMessage, type: 'system' }])
		setCurrentMessage('')

		// Basic validation - check if file path is provided
		if (!filePath.trim()) {
			addSystemMessage(
				'File path cannot be empty. Please provide a valid file path.'
			)
			return
		}

		// Store file path and move to caption stage
		setTempFilePath(filePath.trim())
		addSystemMessage(
			'Enter a caption for the file (optional, press Enter to skip):'
		)
		setFileUploadStage('caption')
	}

	const handleFileCaptionInput = async (caption: string) => {
		// Add user input to system messages (even if empty)
		const userMessage = {
			id: `file-caption-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			text: caption || '(no caption)',
			timestamp: new Date(),
			type: 'user' as const,
		}
		setSystemMessages((prev) => [...prev, { ...userMessage, type: 'system' }])
		setCurrentMessage('')

		// Store caption and proceed with upload
		setTempFileCaption(caption.trim())
		setFileUploadStage('uploading')
		addSystemMessage('📤 Uploading file...')

		// Attempt file upload
		void handleFileUpload(tempFilePath, caption.trim())
	}

	const handleFileUpload = async (filePath: string, caption: string) => {
		if (!userPhoneNumber || !botPhoneNumber) {
			addSystemMessage('❌ Upload failed: Phone numbers not configured')
			setFileUploadStage('idle')
			return
		}

		try {
			// TODO: Implement actual file upload via API client
			// For now, simulate file upload
			await new Promise((resolve) => setTimeout(resolve, 2000)) // Simulate upload delay

			// Simulate file upload (since no real API endpoint exists yet)
			const fileType = filePath.split('.').pop()?.toLowerCase() || 'file'
			const fileName = filePath.split('/').pop() || filePath

			// Send a text message indicating the file was uploaded
			const fileMessage = `📎 File: ${fileName}${caption ? `\nCaption: ${caption}` : ''}`
			await apiClient.sendMessage(userPhoneNumber, botPhoneNumber, fileMessage)

			addSystemMessage('✅ File uploaded successfully!')

			// Reload conversation to show the new message
			await loadConversation()
		} catch (error) {
			addSystemMessage(
				`❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		} finally {
			// Reset file upload state
			setFileUploadStage('idle')
			setTempFilePath('')
			setTempFileCaption('')
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
				// Start file upload process
				if (setupStage !== 'complete') {
					addSystemMessage(
						'❌ Please complete setup first before uploading files.'
					)
					return
				}
				addSystemMessage('📁 File upload started. Enter the path to your file:')
				setFileUploadStage('path')
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
		// File upload stage takes precedence
		if (fileUploadStage === 'path') {
			return 'Enter file path (e.g., /path/to/file.jpg)'
		}
		if (fileUploadStage === 'caption') {
			return 'Enter caption (optional)'
		}
		if (fileUploadStage === 'uploading') {
			return 'Uploading...'
		}

		// Setup stage placeholders
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
		<Box flexDirection="column" paddingBottom={3}>
			{/* Conversation area - let content flow naturally */}
			<Box flexDirection="column" paddingX={2}>
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
			</Box>

			{/* Input area - minimal structure */}
			<Box borderStyle="single" borderColor="gray" paddingX={1}>
				<TextInput
					value={currentMessage}
					onChange={handleMessageChange}
					placeholder={getPlaceholderText()}
					focus={fileUploadStage !== 'uploading'}
				/>
			</Box>

			{/* Command palette - appears below input when typing slash commands (only in complete setup and not during file upload) */}
			{showCommandPalette &&
				setupStage === 'complete' &&
				fileUploadStage === 'idle' && (
					<Box paddingLeft={2} flexDirection="column">
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

			{/* File upload help text */}
			{(fileUploadStage === 'path' || fileUploadStage === 'caption') && (
				<Box paddingX={1}>
					<Text color="gray" dimColor>
						{fileUploadStage === 'path'
							? 'Enter file path | Esc: Cancel'
							: 'Enter caption or press Enter to skip | Esc: Cancel'}
					</Text>
				</Box>
			)}

			{/* Status indicator - positioned at bottom right */}
			{userPhoneNumber && botPhoneNumber && (
				<Box justifyContent="flex-end" paddingRight={1}>
					<Text color="gray" dimColor>
						{userPhoneNumber} → {botPhoneNumber}{' '}
						<Text color={isConnected ? 'green' : 'red'}>●</Text>
					</Text>
				</Box>
			)}
		</Box>
	)
}

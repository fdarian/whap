import { format } from 'date-fns'
import { Box, Text, useInput } from 'ink'
import { type FC, useCallback, useEffect, useState } from 'react'
import type { ApiClient, Message } from '../utils/api-client.ts'
import { useTerminal } from '../utils/terminal.ts'
import { webSocketClient } from '../utils/websocket-client.ts'
import { TextInput } from './TextInput.tsx'

interface ChatInterfaceProps {
	apiClient: ApiClient
}

export const ChatInterface: FC<ChatInterfaceProps> = ({ apiClient }) => {
	const [messages, setMessages] = useState<Message[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string>('')
	const [currentMessage, setCurrentMessage] = useState('')
	const [fromNumber, setFromNumber] = useState('')
	const [toNumber, setToNumber] = useState('')
	const [currentStep, setCurrentStep] = useState<'from' | 'to' | 'message'>(
		'from'
	)
	const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
		'idle'
	)
	const [errorMessage, setErrorMessage] = useState('')
	const terminal = useTerminal()

	// Calculate max messages based on available space - very conservative
	const calculateMaxMessages = useCallback(() => {
		// Always show a small, fixed number of messages to ensure readability
		// This prevents any truncation or layout issues
		if (terminal.columns < 60) {
			return 2 // Very narrow terminals
		}
		if (terminal.columns < 80) {
			return 3 // Standard narrow terminals
		}
		return 4 // Wider terminals
	}, [terminal.columns])

	const loadConversation = useCallback(
		async (fromNumber?: string, toNumber?: string) => {
			setLoading(true)
			setError('')

			try {
				const history = await apiClient.getConversationHistory(
					fromNumber,
					toNumber
				)
				setMessages(history.messages)
			} catch (err) {
				setError(
					err instanceof Error ? err.message : 'Failed to load conversation'
				)
			} finally {
				setLoading(false)
			}
		},
		[apiClient]
	)

	useEffect(() => {
		loadConversation()

		const handleWebSocketMessage = (message: {
			type: string
			payload: unknown
		}) => {
			if (message.type === 'NEW_MESSAGE') {
				if (fromNumber && toNumber) {
					loadConversation(fromNumber, toNumber)
				} else {
					// If no conversation is selected, load all messages
					loadConversation()
				}
			}
		}

		webSocketClient.addMessageListener(handleWebSocketMessage)

		return () => {
			webSocketClient.removeMessageListener(handleWebSocketMessage)
		}
	}, [fromNumber, toNumber, loadConversation])

	useInput((input, key) => {
		if (key.return) {
			if (currentStep === 'from') {
				if (fromNumber.trim()) {
					setCurrentStep('to')
				}
			} else if (currentStep === 'to') {
				if (toNumber.trim()) {
					setCurrentStep('message')
				}
			} else if (currentStep === 'message') {
				if (currentMessage.trim()) {
					void handleSendMessage()
				}
			}
			return
		}

		if (key.escape) {
			if (currentStep === 'message') {
				setCurrentStep('to')
				setCurrentMessage('')
			} else if (currentStep === 'to') {
				setCurrentStep('from')
				setToNumber('')
			}
			return
		}

		if (key.ctrl && input === 'r') {
			loadConversation(fromNumber || undefined, toNumber || undefined)
		}

		if (key.ctrl && input === 'c') {
			// Let parent handle exit
			return
		}

		if (key.ctrl && input === 'n') {
			// New conversation - reset phone numbers
			setFromNumber('')
			setToNumber('')
			setCurrentStep('from')
			setCurrentMessage('')
			setMessages([])
		}
	})

	const handleSendMessage = async () => {
		if (!fromNumber.trim() || !toNumber.trim() || !currentMessage.trim()) return

		setStatus('sending')
		setErrorMessage('')

		try {
			await apiClient.sendMessage(fromNumber, toNumber, currentMessage)
			setStatus('sent')
			setCurrentMessage('')

			// Reload conversation to show the new message
			await loadConversation(fromNumber, toNumber)

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
		// Use local timezone with date included if today, or just time if same day
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
		const phoneNumber = isOutgoing ? message.to : message.from
		const messageText = message.text?.trim() || '(empty)'

		const direction = isOutgoing ? '→' : '←'

		// Keep phone number short - just last 6 digits
		const shortPhone =
			phoneNumber.length > 10 ? `...${phoneNumber.slice(-6)}` : phoneNumber

		// Use multi-line layout with word wrapping like regular chat
		return (
			<Box key={message.id} flexDirection="column" marginBottom={1}>
				<Box>
					<Text color="gray" dimColor>
						{timestamp} {direction} {shortPhone}
					</Text>
				</Box>
				<Box paddingLeft={2}>
					<Text color={isOutgoing ? 'cyan' : 'green'} wrap="wrap">
						{messageText}
					</Text>
				</Box>
			</Box>
		)
	}

	const renderStatusBar = () => {
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

	const getInputPlaceholder = () => {
		switch (currentStep) {
			case 'from':
				return 'Enter YOUR phone number (user) (e.g., 6286777363432)...'
			case 'to':
				return 'Enter BOT phone number ID (e.g., 6286777363433)...'
			case 'message':
				return 'Type your message to the bot...'
		}
	}

	const getInputValue = () => {
		switch (currentStep) {
			case 'from':
				return fromNumber
			case 'to':
				return toNumber
			case 'message':
				return currentMessage
		}
	}

	const handleInputChange = (value: string) => {
		switch (currentStep) {
			case 'from':
				setFromNumber(value)
				break
			case 'to':
				setToNumber(value)
				break
			case 'message':
				setCurrentMessage(value)
				break
		}
	}

	const getStepIndicator = () => {
		switch (currentStep) {
			case 'from':
				return 'Step 1 of 3'
			case 'to':
				return 'Step 2 of 3'
			case 'message':
				return 'Step 3 of 3'
		}
	}

	const getConversationTitle = () => {
		if (fromNumber && toNumber) {
			return `User ${fromNumber} → Bot ${toNumber}`
		}
		return 'WhatsApp Bot Test Chat'
	}

	return (
		<Box flexDirection="column" height="100%">
			{/* Header */}
			<Box justifyContent="space-between" marginBottom={1}>
				<Text bold color="cyan">
					{getConversationTitle()}
				</Text>
				<Text color="gray" dimColor>
					{messages.length} messages | Ctrl+R: Refresh | Ctrl+N: New Chat
				</Text>
			</Box>

			{/* Message History Area */}
			<Box flexDirection="column" flexGrow={1} marginBottom={1}>
				{loading && (
					<Box paddingY={1}>
						<Text color="yellow">Loading conversation...</Text>
					</Box>
				)}

				{error && (
					<Box paddingY={1}>
						<Text color="red">Error: {error}</Text>
					</Box>
				)}

				{!loading && messages.length === 0 && currentStep === 'from' && (
					<Box
						flexDirection="column"
						alignItems="center"
						justifyContent="center"
						height="100%"
						paddingY={2}
					>
						<Text color="gray" dimColor>
							🤖 Test your WhatsApp bot
						</Text>
						<Box marginTop={1}>
							<Text color="gray" dimColor>
								Enter your phone number and bot's phone number below
							</Text>
						</Box>
					</Box>
				)}

				{!loading && messages.length === 0 && fromNumber && toNumber && (
					<Box
						flexDirection="column"
						alignItems="center"
						justifyContent="center"
						height="100%"
						paddingY={2}
					>
						<Text color="gray" dimColor>
							No messages between you and the bot yet
						</Text>
						<Box marginTop={1}>
							<Text color="gray" dimColor>
								Type a message below to test your bot
							</Text>
						</Box>
					</Box>
				)}

				{messages.length > 0 && (
					<Box flexDirection="column" paddingY={1}>
						<Box marginBottom={1}>
							<Text color="gray" dimColor>
								Recent messages (newest first):
							</Text>
						</Box>
						<Box flexDirection="column">
							{messages
								.slice()
								.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) // Sort newest first
								.slice(0, calculateMaxMessages()) // Dynamic message limit based on terminal size
								.map(renderMessage)}
						</Box>
						{messages.length > calculateMaxMessages() && (
							<Box marginTop={1}>
								<Text color="gray" dimColor>
									... and {messages.length - calculateMaxMessages()} more
									messages (use Ctrl+R to refresh)
								</Text>
							</Box>
						)}
					</Box>
				)}
			</Box>

			{/* Input Area */}
			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
				paddingY={1}
			>
				<Box justifyContent="space-between" marginBottom={1}>
					<Text color="gray">
						{currentStep === 'from' && '📞 Your Number (User):'}
						{currentStep === 'to' && '🤖 Bot Number (Recipient):'}
						{currentStep === 'message' && '💬 Message to Bot:'}
					</Text>
					<Box>{status !== 'idle' && renderStatusBar()}</Box>
				</Box>

				<Box marginBottom={1}>
					<TextInput
						value={getInputValue()}
						onChange={handleInputChange}
						placeholder={getInputPlaceholder()}
						focus={true}
					/>
				</Box>

				<Box justifyContent="space-between">
					<Box flexDirection="row" gap={2}>
						<Text color="gray" dimColor>
							{getStepIndicator()}
						</Text>
						<Text color="gray" dimColor>
							{currentStep === 'from' &&
								'Press Enter to continue to bot number'}
							{currentStep === 'to' && 'Press Enter to continue to message'}
							{currentStep === 'message' &&
								'Press Enter to send to bot | Esc to change bot number'}
						</Text>
					</Box>
					<Text color="gray" dimColor>
						Ctrl+N: New Chat
					</Text>
				</Box>
			</Box>
		</Box>
	)
}

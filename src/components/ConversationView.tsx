import { format } from 'date-fns'
import { Box, Text, useInput } from 'ink'
import { type FC, useCallback, useEffect, useState } from 'react'
import type { ApiClient, Message } from '../utils/api-client.ts'
import { useTerminal } from '../utils/terminal.ts'
import { webSocketClient } from '../utils/websocket-client.ts'

interface ConversationViewProps {
	apiClient: ApiClient
}

export const ConversationView: FC<ConversationViewProps> = ({ apiClient }) => {
	const [messages, setMessages] = useState<Message[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string>('')
	const [fromFilter, setFromFilter] = useState<string>('')
	const [toFilter, setToFilter] = useState<string>('')
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
		return 5 // Wider terminals (slightly more for conversation view)
	}, [terminal.columns])

	const loadConversation = useCallback(
		async (from?: string, to?: string) => {
			setLoading(true)
			setError('')

			try {
				const history = await apiClient.getConversationHistory(from, to)
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
				loadConversation(fromFilter || undefined, toFilter || undefined)
			}
		}

		webSocketClient.addMessageListener(handleWebSocketMessage)

		return () => {
			webSocketClient.removeMessageListener(handleWebSocketMessage)
		}
	}, [fromFilter, toFilter, loadConversation])

	useInput((input, key) => {
		if (key.ctrl && input === 'r') {
			loadConversation(fromFilter || undefined, toFilter || undefined)
		}

		if (key.ctrl && input === 'c') {
			// Clear conversation
			apiClient.clearConversation().then(() => {
				setMessages([])
			})
		}

		if (key.ctrl && input === 'f') {
			// Quick filter by from number (cycle through participants)
			// This is a placeholder - in a real app you'd want a proper filter UI
		}
	})

	const renderMessage = (message: Message) => {
		// Use local timezone with date included
		const msgDate = new Date(message.timestamp)
		const timestamp = format(msgDate, 'MM/dd HH:mm')

		const isOutgoing = message.direction === 'sent'
		const phoneNumber = isOutgoing ? message.to : message.from
		const messageText = message.text?.trim() || '(empty)'

		const direction = isOutgoing ? '→' : '←'

		// Keep phone number short - just last 6 digits
		const shortPhone =
			phoneNumber.length > 10 ? `...${phoneNumber.slice(-6)}` : phoneNumber

		// Use multi-line layout with word wrapping like regular chat
		const header = `${timestamp} ${direction} ${shortPhone}`
		const indentation = '  '

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

	const getFilterStatus = () => {
		if (fromFilter && toFilter) {
			return `Filtered: ${fromFilter} → ${toFilter}`
		}
		if (fromFilter) {
			return `From: ${fromFilter}`
		}
		if (toFilter) {
			return `To: ${toFilter}`
		}
		return 'All messages'
	}

	return (
		<Box flexDirection="column" gap={1}>
			<Box justifyContent="space-between">
				<Text bold>Conversation History</Text>
				<Text color="gray" dimColor>
					{messages.length} messages | Ctrl+R: Refresh | Ctrl+C: Clear
				</Text>
			</Box>

			<Box>
				<Text color="gray" dimColor>
					{getFilterStatus()} | Use Compose tab to filter by from/to numbers
				</Text>
			</Box>

			{loading && <Text color="yellow">Loading conversation...</Text>}

			{error && <Text color="red">Error: {error}</Text>}

			{!loading && messages.length === 0 && (
				<Box flexDirection="column" alignItems="center" paddingY={2}>
					<Text color="gray" dimColor>
						No messages yet
					</Text>
					<Text color="gray" dimColor>
						Send a message from the Compose tab to see it here
					</Text>
				</Box>
			)}

			{messages.length > 0 && (
				<Box flexDirection="column" paddingY={1}>
					<Text color="gray" dimColor>
						Recent messages (newest first):
					</Text>
					<Box flexDirection="column" marginTop={1}>
						{messages
							.slice()
							.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) // Sort newest first
							.slice(0, calculateMaxMessages()) // Dynamic message limit based on terminal size
							.map(renderMessage)}
					</Box>
				</Box>
			)}

			{messages.length > calculateMaxMessages() && (
				<Text color="gray" dimColor>
					... and {messages.length - calculateMaxMessages()} more messages (use
					Ctrl+R to refresh)
				</Text>
			)}
		</Box>
	)
}

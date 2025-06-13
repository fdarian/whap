import { Box, Text, useApp, useInput } from 'ink'
import { type FC, useEffect, useState } from 'react'
import { ApiClient } from '../utils/api-client.ts'
import { useTerminal } from '../utils/terminal.ts'
import { webSocketClient } from '../utils/websocket-client.ts'
import { OnboardingFlow } from './OnboardingFlow.tsx'
import { SimplifiedChatInterface } from './SimplifiedChatInterface.tsx'

export const WhatsAppTestCLI: FC = () => {
	const [apiClient] = useState(() => new ApiClient())
	const [isConnected, setIsConnected] = useState(false)
	const [userPhoneNumber, setUserPhoneNumber] = useState('')
	const [botPhoneNumber, setBotPhoneNumber] = useState('')
	const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
	const { exit } = useApp()
	const terminal = useTerminal()

	// Check connection to mock server on startup and manage websocket connection
	useEffect(() => {
		webSocketClient.connect()

		const handleConnectionChange = (connected: boolean) => {
			setIsConnected(connected)
		}

		// Set initial state
		setIsConnected(webSocketClient.isConnected)

		// Listen for changes
		webSocketClient.addConnectionStatusListener(handleConnectionChange)

		return () => {
			webSocketClient.removeConnectionStatusListener(handleConnectionChange)
			webSocketClient.disconnect()
		}
	}, [])

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			exit()
			return
		}

		if (key.ctrl && input === 'n' && isOnboardingComplete) {
			handleNewConversation()
			return
		}
	})

	const handleOnboardingComplete = (userNumber: string, botNumber: string) => {
		setUserPhoneNumber(userNumber)
		setBotPhoneNumber(botNumber)
		setIsOnboardingComplete(true)
	}

	const handleNewConversation = () => {
		setUserPhoneNumber('')
		setBotPhoneNumber('')
		setIsOnboardingComplete(false)
	}

	if (!isOnboardingComplete) {
		return (
			<Box flexDirection="column" height={terminal.rows}>
				{/* Simple header during onboarding */}
				<Box paddingX={3} paddingY={1} borderStyle="single" borderColor="cyan">
					<Box
						flexDirection="row"
						justifyContent="space-between"
						alignItems="center"
					>
						<Text bold color="cyan">
							WhatsApp Bot Test CLI
						</Text>
						<Text color={isConnected ? 'green' : 'red'}>
							● {isConnected ? 'Connected' : 'Disconnected'}
						</Text>
					</Box>
				</Box>

				{/* Onboarding flow takes the rest of the screen */}
				<Box flexGrow={1}>
					<OnboardingFlow onComplete={handleOnboardingComplete} />
				</Box>
			</Box>
		)
	}

	return (
		<Box flexDirection="column" height={terminal.rows}>
			{/* Enhanced header with user/bot info */}
			<Box paddingX={3} paddingY={1} borderStyle="single" borderColor="cyan">
				<Box
					flexDirection="row"
					justifyContent="space-between"
					alignItems="center"
					flexWrap="wrap"
				>
					<Box flexDirection="row" alignItems="center" gap={4}>
						<Text bold color="cyan">
							WhatsApp Bot Test CLI
						</Text>
						<Text color="gray" dimColor>
							User: {userPhoneNumber}
						</Text>
						<Text color="gray" dimColor>
							→ Bot: {botPhoneNumber}
						</Text>
					</Box>
					<Box flexDirection="row" alignItems="center" gap={4}>
						<Text color={isConnected ? 'green' : 'red'}>
							● {isConnected ? 'Connected' : 'Disconnected'}
						</Text>
						<Text color="gray" dimColor>
							Ctrl+N: New | Ctrl+C: Exit
						</Text>
					</Box>
				</Box>
			</Box>

			{/* Simplified chat interface takes the rest */}
			<Box flexGrow={1}>
				<SimplifiedChatInterface
					apiClient={apiClient}
					userPhoneNumber={userPhoneNumber}
					botPhoneNumber={botPhoneNumber}
					onNewConversation={handleNewConversation}
				/>
			</Box>
		</Box>
	)
}

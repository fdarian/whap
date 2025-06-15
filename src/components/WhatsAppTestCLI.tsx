import { Box, useApp, useInput } from 'ink'
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
				<OnboardingFlow onComplete={handleOnboardingComplete} />
			</Box>
		)
	}

	return (
		<Box flexDirection="column" height={terminal.rows}>
			<SimplifiedChatInterface
				apiClient={apiClient}
				userPhoneNumber={userPhoneNumber}
				botPhoneNumber={botPhoneNumber}
				onNewConversation={handleNewConversation}
				isConnected={isConnected}
			/>
		</Box>
	)
}

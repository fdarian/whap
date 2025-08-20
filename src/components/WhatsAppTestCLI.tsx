import { useApp, useInput } from 'ink'
import { type FC, useEffect, useState } from 'react'
import { ApiClient } from '../utils/api-client.ts'
import { createWebSocketClient } from '../utils/websocket-client.ts'
import { SimplifiedChatInterface } from './SimplifiedChatInterface.tsx'

export interface WhatsAppTestCLIProps {
	serverUrl?: string
}

export const WhatsAppTestCLI: FC<WhatsAppTestCLIProps> = ({ serverUrl }) => {
	const [apiClient] = useState(() => new ApiClient(serverUrl))
	const [wsClient] = useState(() => createWebSocketClient(serverUrl))
	const [isConnected, setIsConnected] = useState(false)
	const [userPhoneNumber, setUserPhoneNumber] = useState('')
	const [botPhoneNumber, setBotPhoneNumber] = useState('')
	const { exit } = useApp()

	// Check connection to mock server on startup and manage websocket connection
	useEffect(() => {
		wsClient.connect()

		const handleConnectionChange = (connected: boolean) => {
			setIsConnected(connected)
		}

		// Set initial state
		setIsConnected(wsClient.isConnected)

		// Listen for changes
		wsClient.addConnectionStatusListener(handleConnectionChange)

		return () => {
			wsClient.removeConnectionStatusListener(handleConnectionChange)
			wsClient.disconnect()
		}
	}, [wsClient])

	useInput((input, key) => {
		if (key.ctrl && input === 'c') {
			exit()
			return
		}

		if (key.ctrl && input === 'n' && userPhoneNumber && botPhoneNumber) {
			handleNewConversation()
			return
		}
	})

	const handleSetupComplete = (userNumber: string, botNumber: string) => {
		setUserPhoneNumber(userNumber)
		setBotPhoneNumber(botNumber)
	}

	const handleNewConversation = () => {
		setUserPhoneNumber('')
		setBotPhoneNumber('')
	}

	return (
		<SimplifiedChatInterface
			apiClient={apiClient}
			wsClient={wsClient}
			userPhoneNumber={userPhoneNumber}
			botPhoneNumber={botPhoneNumber}
			onSetupComplete={handleSetupComplete}
			onNewConversation={handleNewConversation}
			isConnected={isConnected}
		/>
	)
}

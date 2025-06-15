import { useApp, useInput } from 'ink'
import { type FC, useEffect, useState } from 'react'
import { ApiClient } from '../utils/api-client.ts'
import { webSocketClient } from '../utils/websocket-client.ts'
import { SimplifiedChatInterface } from './SimplifiedChatInterface.tsx'

export const WhatsAppTestCLI: FC = () => {
	const [apiClient] = useState(() => new ApiClient())
	const [isConnected, setIsConnected] = useState(false)
	const [userPhoneNumber, setUserPhoneNumber] = useState('')
	const [botPhoneNumber, setBotPhoneNumber] = useState('')
	const { exit } = useApp()

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
			userPhoneNumber={userPhoneNumber}
			botPhoneNumber={botPhoneNumber}
			onSetupComplete={handleSetupComplete}
			onNewConversation={handleNewConversation}
			isConnected={isConnected}
		/>
	)
}

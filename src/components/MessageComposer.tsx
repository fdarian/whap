import { Box, Text, useInput } from 'ink'
import { type FC, useState } from 'react'
import type { ApiClient } from '../utils/api-client.ts'
import { TextInput } from './TextInput.tsx'

interface MessageComposerProps {
	apiClient: ApiClient
}

export const MessageComposer: FC<MessageComposerProps> = ({ apiClient }) => {
	const [fromNumber, setFromNumber] = useState('')
	const [toNumber, setToNumber] = useState('')
	const [message, setMessage] = useState('')
	const [currentStep, setCurrentStep] = useState<'from' | 'to' | 'message'>(
		'from'
	)
	const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
		'idle'
	)
	const [errorMessage, setErrorMessage] = useState('')

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
				if (message.trim()) {
					void handleSendMessage()
				}
			}
			return
		}

		if (key.escape) {
			if (currentStep === 'message') {
				setCurrentStep('to')
				setMessage('')
			} else if (currentStep === 'to') {
				setCurrentStep('from')
				setToNumber('')
			}
			return
		}

		if (key.ctrl && input === 'c') {
			// Let parent handle exit
			return
		}
	})

	const handleSendMessage = async () => {
		if (!fromNumber.trim() || !toNumber.trim() || !message.trim()) return

		setStatus('sending')
		setErrorMessage('')

		try {
			await apiClient.sendMessage(fromNumber, toNumber, message)
			setStatus('sent')
			setMessage('')
			setCurrentStep('from')

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

	const renderStatusBar = () => {
		switch (status) {
			case 'sending':
				return <Text color="yellow">Sending message...</Text>
			case 'sent':
				return <Text color="green">✓ Message sent successfully!</Text>
			case 'error':
				return <Text color="red">✗ Error: {errorMessage}</Text>
			default:
				return null
		}
	}

	const getStepPrompt = () => {
		switch (currentStep) {
			case 'from':
				return 'Press Enter to continue to recipient'
			case 'to':
				return 'Press Enter to continue to message'
			case 'message':
				return 'Press Enter to send | Esc to go back to recipient'
		}
	}

	const getNavigationHint = () => {
		if (currentStep === 'from') {
			return 'Step 1 of 3'
		}
		if (currentStep === 'to') {
			return 'Step 2 of 3 | Esc to go back to sender'
		}
		return 'Step 3 of 3 | Esc to go back to recipient'
	}

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>Compose Message</Text>

			<Box flexDirection="column" gap={2}>
				{/* From Number Input */}
				<Box flexDirection="column">
					<Text color={currentStep === 'from' ? 'cyan' : 'gray'}>
						From Phone Number (Indonesian format, e.g., 6286777363432):
					</Text>
					<Box>
						<TextInput
							value={fromNumber}
							onChange={setFromNumber}
							placeholder="Enter sender phone number..."
							focus={currentStep === 'from'}
						/>
					</Box>
				</Box>

				{/* To Number Input */}
				{(currentStep === 'to' || currentStep === 'message') && (
					<Box flexDirection="column">
						<Text color={currentStep === 'to' ? 'cyan' : 'gray'}>
							To Phone Number (Indonesian format, e.g., 6286777363433):
						</Text>
						<Box>
							<TextInput
								value={toNumber}
								onChange={setToNumber}
								placeholder="Enter recipient phone number..."
								focus={currentStep === 'to'}
							/>
						</Box>
					</Box>
				)}

				{/* Message Input */}
				{currentStep === 'message' && (
					<Box flexDirection="column">
						<Text color="cyan">Message:</Text>
						<Box>
							<TextInput
								value={message}
								onChange={setMessage}
								placeholder="Type your message..."
								focus={currentStep === 'message'}
							/>
						</Box>
					</Box>
				)}

				{/* Step Indicator and Navigation */}
				<Box flexDirection="column">
					<Text color="gray" dimColor>
						{getNavigationHint()}
					</Text>
					<Text color="gray" dimColor>
						{getStepPrompt()}
					</Text>
				</Box>

				{/* Status */}
				{status !== 'idle' && <Box>{renderStatusBar()}</Box>}

				{/* Current Values Display */}
				<Box flexDirection="column" paddingTop={1} borderTop>
					<Text color="gray" dimColor>
						Current Values:
					</Text>
					<Text color="gray" dimColor>
						From: {fromNumber || '(not set)'}
					</Text>
					<Text color="gray" dimColor>
						To: {toNumber || '(not set)'}
					</Text>
					<Text color="gray" dimColor>
						Message: {message || '(not set)'}
					</Text>
				</Box>

				{/* Quick Templates */}
				<Box flexDirection="column" paddingTop={1} borderTop>
					<Text color="gray" dimColor>
						Quick Templates (coming soon):
					</Text>
					<Text color="gray" dimColor>
						• Hello greeting
					</Text>
					<Text color="gray" dimColor>
						• Booking confirmation
					</Text>
					<Text color="gray" dimColor>
						• Payment reminder
					</Text>
				</Box>
			</Box>
		</Box>
	)
}

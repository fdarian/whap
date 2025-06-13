import { Box, Text, useInput } from 'ink'
import { type FC, useState } from 'react'
import { TextInput } from './TextInput.tsx'

interface OnboardingFlowProps {
	onComplete: (userNumber: string, botNumber: string) => void
}

export const OnboardingFlow: FC<OnboardingFlowProps> = ({ onComplete }) => {
	const [currentStep, setCurrentStep] = useState<'user' | 'bot'>('user')
	const [userPhoneNumber, setUserPhoneNumber] = useState('')
	const [botPhoneNumber, setBotPhoneNumber] = useState('')
	const [validationError, setValidationError] = useState('')

	// Phone number validation functions
	const validateUserPhoneNumber = (phone: string): boolean => {
		// Indonesian phone number format: starts with 62, followed by 8-12 digits
		// Total length should be 10-14 digits (62 + 8-12 digits)
		const phoneRegex = /^62\d{8,12}$/
		return phoneRegex.test(phone.trim())
	}

	const validateBotPhoneNumberId = (phoneId: string): boolean => {
		// Check if input contains only numbers
		return /^\d+$/.test(phoneId.trim())
	}

	const getValidationMessage = (
		step: 'user' | 'bot',
		value: string
	): string => {
		if (!value.trim()) {
			return step === 'user'
				? 'Phone number is required'
				: 'Phone number ID is required'
		}

		if (step === 'user' && !validateUserPhoneNumber(value)) {
			return 'Invalid phone number format. Use Indonesian format: 6286777363432'
		}

		if (step === 'bot' && !validateBotPhoneNumberId(value)) {
			return 'Invalid phone number ID format. Use format: 6286777363432'
		}

		return ''
	}

	useInput((input, key) => {
		if (key.return) {
			if (currentStep === 'user') {
				const error = getValidationMessage('user', userPhoneNumber)
				if (error) {
					setValidationError(error)
					return
				}
				setValidationError('')
				setCurrentStep('bot')
			} else if (currentStep === 'bot') {
				const error = getValidationMessage('bot', botPhoneNumber)
				if (error) {
					setValidationError(error)
					return
				}
				setValidationError('')
				onComplete(userPhoneNumber.trim(), botPhoneNumber.trim())
			}
			return
		}

		if (key.escape && currentStep === 'bot') {
			setCurrentStep('user')
			setBotPhoneNumber('')
			setValidationError('')
		}
	})

	const handleInputChange = (value: string) => {
		// Clear validation error when user starts typing
		if (validationError) {
			setValidationError('')
		}

		if (currentStep === 'user') {
			setUserPhoneNumber(value)
		} else {
			setBotPhoneNumber(value)
		}
	}

	const getCurrentValue = () => {
		return currentStep === 'user' ? userPhoneNumber : botPhoneNumber
	}

	const getPlaceholder = () => {
		return currentStep === 'user'
			? 'Enter your phone number (e.g., 6286777363432)'
			: 'Enter bot phone number ID (e.g., 6286777363433)'
	}

	const getTitle = () => {
		return currentStep === 'user'
			? '📞 Setup Your Phone Number'
			: '🤖 Setup Bot Phone Number ID'
	}

	const getDescription = () => {
		return currentStep === 'user'
			? 'This will be used as the sender when testing your WhatsApp bot'
			: 'This is the WhatsApp phone number ID of your bot that will receive messages'
	}

	const getStepIndicator = () => {
		return currentStep === 'user' ? 'Step 1 of 2' : 'Step 2 of 2'
	}

	return (
		<Box
			flexDirection="column"
			alignItems="center"
			justifyContent="center"
			height="100%"
		>
			<Box flexDirection="column" alignItems="center" marginBottom={4}>
				<Text bold color="cyan">
					{getTitle()}
				</Text>
				<Box marginTop={1}>
					<Text color="gray" dimColor>
						{getDescription()}
					</Text>
				</Box>
			</Box>

			<Box flexDirection="column" alignItems="center" width={60}>
				<Box marginBottom={2} width="100%">
					<TextInput
						value={getCurrentValue()}
						onChange={handleInputChange}
						placeholder={getPlaceholder()}
						focus={true}
					/>
				</Box>

				{/* Validation Error Display */}
				{validationError && (
					<Box marginBottom={2}>
						<Text color="red">❌ {validationError}</Text>
					</Box>
				)}

				<Box flexDirection="column" alignItems="center">
					<Text color="gray" dimColor>
						{getStepIndicator()}
					</Text>
					<Box marginTop={1}>
						<Text color="gray" dimColor>
							{currentStep === 'user'
								? 'Press Enter to continue'
								: 'Press Enter to start testing | Esc to go back'}
						</Text>
					</Box>
				</Box>

				{/* Format hint */}
				<Box marginTop={2} flexDirection="column" alignItems="center">
					<Text color="gray" dimColor>
						{currentStep === 'user'
							? 'Format: Indonesian number starting with 62 (no + sign)'
							: 'Format: WhatsApp Business API Phone Number ID'}
					</Text>
				</Box>
			</Box>

			{/* Show progress */}
			{currentStep === 'bot' && (
				<Box marginTop={4} flexDirection="column" alignItems="center">
					<Text color="green" dimColor>
						✓ User: {userPhoneNumber}
					</Text>
				</Box>
			)}
		</Box>
	)
}

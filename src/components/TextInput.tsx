import { Box, Text, useInput } from 'ink'
import { type FC, useEffect, useState } from 'react'

interface TextInputProps {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	focus?: boolean
}

export const TextInput: FC<TextInputProps> = ({
	value,
	onChange,
	placeholder = '',
	focus = true,
}) => {
	const [localValue, setLocalValue] = useState(value)

	useEffect(() => {
		setLocalValue(value)
	}, [value])

	useInput(
		(input, key) => {
			if (!focus) return

			if (key.delete || key.backspace) {
				const newValue = localValue.slice(0, -1)
				setLocalValue(newValue)
				onChange(newValue)
			} else if (
				input &&
				!key.ctrl &&
				!key.meta &&
				!key.return &&
				!key.escape
			) {
				const newValue = localValue + input
				setLocalValue(newValue)
				onChange(newValue)
			}
		},
		{ isActive: focus }
	)

	const displayValue = localValue || placeholder
	const showCursor = focus

	return (
		<Box width="100%" minHeight={1}>
			<Text color={localValue ? 'white' : 'gray'}>
				{displayValue}
				{showCursor && <Text color="cyan">│</Text>}
			</Text>
		</Box>
	)
}

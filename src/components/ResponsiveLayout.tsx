import { Box, Text } from 'ink'
import type { FC, ReactNode } from 'react'
import { useTerminal } from '../utils/terminal.ts'

interface ResponsiveBoxProps {
	children: ReactNode
	minWidth?: number
	breakpoint?: number
	smallLayout?: ReactNode
	largeLayout?: ReactNode
}

export const ResponsiveBox: FC<ResponsiveBoxProps> = ({
	children,
	minWidth = 80,
	breakpoint = 100,
	smallLayout,
	largeLayout,
}) => {
	const terminal = useTerminal()
	const isSmall = terminal.columns < breakpoint || terminal.columns < minWidth

	if (smallLayout && largeLayout) {
		return <>{isSmall ? smallLayout : largeLayout}</>
	}

	return (
		<Box flexDirection={isSmall ? 'column' : 'row'} flexWrap="wrap">
			{children}
		</Box>
	)
}

interface TruncatedTextProps {
	children: string
	maxLength?: number
	color?: string
	bold?: boolean
}

export const TruncatedText: FC<TruncatedTextProps> = ({
	children,
	maxLength,
	color,
	bold,
}) => {
	const terminal = useTerminal()
	const effectiveMaxLength = maxLength || Math.max(20, terminal.columns - 10)

	const truncated =
		children.length > effectiveMaxLength
			? `${children.slice(0, effectiveMaxLength - 3)}...`
			: children

	return (
		<Text color={color} bold={bold}>
			{truncated}
		</Text>
	)
}

interface FlexibleLayoutProps {
	header?: ReactNode
	content: ReactNode
	footer?: ReactNode
	sidebar?: ReactNode
}

export const FlexibleLayout: FC<FlexibleLayoutProps> = ({
	header,
	content,
	footer,
	sidebar,
}) => {
	const terminal = useTerminal()
	const showSidebar = sidebar && terminal.columns > 120

	return (
		<Box flexDirection="column" minHeight={terminal.rows}>
			{header}
			<Box flexGrow={1} flexDirection="row">
				<Box flexGrow={1}>{content}</Box>
				{showSidebar && (
					<Box width={Math.min(30, Math.floor(terminal.columns * 0.25))}>
						{sidebar}
					</Box>
				)}
			</Box>
			{footer}
		</Box>
	)
}

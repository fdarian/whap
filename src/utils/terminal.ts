import { useStdout } from 'ink'
import { useEffect, useState } from 'react'

/**
 * Hook to get terminal dimensions and listen for resize events
 * This helps ensure proper layout in different terminal environments
 */
export function useTerminal() {
	const { stdout } = useStdout()
	const [dimensions, setDimensions] = useState({
		columns: stdout?.columns || 80,
		rows: stdout?.rows || 24,
	})

	useEffect(() => {
		if (!stdout) return

		const updateDimensions = () => {
			setDimensions({
				columns: stdout.columns || 80,
				rows: stdout.rows || 24,
			})
		}

		// Initial update
		updateDimensions()

		// Listen for resize events
		stdout.on('resize', updateDimensions)

		return () => {
			stdout.off('resize', updateDimensions)
		}
	}, [stdout])

	return dimensions
}

/**
 * Get safe terminal dimensions with fallbacks
 */
export function getTerminalInfo() {
	const columns = process.stdout.columns || 80
	const rows = process.stdout.rows || 24

	return {
		columns,
		rows,
		isWarp: process.env.TERM_PROGRAM === 'WarpTerminal',
		isTmux: !!process.env.TMUX,
		isIterm: process.env.TERM_PROGRAM === 'iTerm.app',
		terminalType: process.env.TERM || 'unknown',
	}
}

/**
 * Debounce function for resize events
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null

	return (...args: Parameters<T>) => {
		if (timeout) {
			clearTimeout(timeout)
		}
		timeout = setTimeout(() => func(...args), wait)
	}
}
